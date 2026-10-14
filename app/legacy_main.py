"""AegisBorder SOC: локальный учебный прототип. Не подключается к реальной инфраструктуре."""
import os, hashlib, hmac, secrets, json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey, Text, select, func, delete, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

DB_URL = os.getenv('DATABASE_URL', 'sqlite:///./aegisborder_dev.db')
engine = create_engine(DB_URL, connect_args={'check_same_thread': False} if DB_URL.startswith('sqlite') else {}, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)
class Base(DeclarativeBase): pass
class User(Base):
    __tablename__='users'
    id=Column(Integer,primary_key=True); username=Column(String(80),unique=True,nullable=False)
    password_hash=Column(String(250),nullable=False); role=Column(String(30),nullable=False,default='analyst')
class Token(Base):
    __tablename__='tokens'
    id=Column(Integer,primary_key=True); user_id=Column(Integer,ForeignKey('users.id'),nullable=False)
    digest=Column(String(64),unique=True,nullable=False); expires=Column(DateTime(timezone=True),nullable=False)
class Event(Base):
    __tablename__='events'
    id=Column(Integer,primary_key=True); time=Column(DateTime(timezone=True),nullable=False)
    source=Column(String(100),nullable=False); type=Column(String(100),nullable=False)
    severity=Column(String(30),nullable=False); scenario=Column(String(80),nullable=False)
    detail=Column(Text,nullable=False)
class Incident(Base):
    __tablename__='incidents'
    id=Column(Integer,primary_key=True); title=Column(String(200),nullable=False)
    risk=Column(Integer,nullable=False); status=Column(String(30),nullable=False,default='Новый')
    explanation=Column(Text,nullable=False); scenario=Column(String(80),nullable=False)
    created_at=Column(DateTime(timezone=True),nullable=False)
class Audit(Base):
    __tablename__='audit'
    id=Column(Integer,primary_key=True); time=Column(DateTime(timezone=True),nullable=False)
    actor=Column(String(80),nullable=False); action=Column(String(150),nullable=False)
    prev_hash=Column(String(64),nullable=False); record_hash=Column(String(64),nullable=False)

def now(): return datetime.now(timezone.utc)
def password_hash(p):
    salt=secrets.token_bytes(16)
    return salt.hex()+':'+hashlib.pbkdf2_hmac('sha256',p.encode(),salt,260000).hex()
def verify_password(p,stored):
    try:
        salt, digest=stored.split(':')
        return hmac.compare_digest(hashlib.pbkdf2_hmac('sha256',p.encode(),bytes.fromhex(salt),260000).hex(),digest)
    except (ValueError,TypeError): return False

def audit(db,actor,action):
    # Serialize chain appenders until their transaction commits, including an empty chain.
    if db.bind.dialect.name == 'postgresql':
        db.execute(text('SELECT pg_advisory_xact_lock(8142026002)'))
    previous=db.scalar(select(Audit).order_by(Audit.id.desc()).limit(1))
    prev=previous.record_hash if previous else '0'*64
    stamp=now()
    payload=json.dumps([stamp.isoformat(),actor,action,prev],ensure_ascii=False,separators=(',',':'))
    key=os.getenv('AUDIT_KEY','development-only-not-secure').encode()
    digest=hmac.new(key,payload.encode(),hashlib.sha256).hexdigest()
    db.add(Audit(time=stamp,actor=actor,action=action,prev_hash=prev,record_hash=digest))

def get_db():
    with SessionLocal() as db: yield db

def auth(authorization: str|None=Header(None),db:Session=Depends(get_db)):
    if not authorization or not authorization.startswith('Bearer '): raise HTTPException(401,'Требуется вход в систему')
    digest=hashlib.sha256(authorization[7:].encode()).hexdigest()
    token=db.scalar(select(Token).where(Token.digest==digest))
    if not token or token.expires.replace(tzinfo=timezone.utc) <= now(): raise HTTPException(401,'Сеанс завершён')
    user=db.get(User,token.user_id)
    if not user: raise HTTPException(401,'Пользователь не найден')
    return user

def operator(user:User=Depends(auth)):
    if user.role not in ('admin','analyst'): raise HTTPException(403,'Недостаточно прав')
    return user

SCENARIOS=[
 ('bruteforce','Подбор пароля','ПК-01',87,['Ошибка входа','Ошибка входа','Ошибка входа','Ошибка входа','Ошибка входа','Успешный вход'],'Пять неудачных попыток, затем успешный вход.'),
 ('night-login','Необычное время входа','ПК-02',58,['Вход в нетипичное время','Доступ к служебному приложению'],'Активность вне обычного учебного графика.'),
 ('suspicious-ip','Подозрительный адрес','Шлюз-01',78,['Соединение с тестовым IP','Обращение к неизвестному домену'],'Тестовый индикатор угрозы найден в локальном справочнике.'),
 ('privileges','Повышение прав','Сервер-01',92,['Вход пользователя','Изменение роли','Доступ к настройкам'],'Неожиданное повышение привилегий.'),
 ('files','Массовые изменения файлов','ПК-03',90,['Изменение файла','Изменение файла','Массовое переименование'],'Необычная массовая файловая активность.'),
 ('transfer','Нетипичная передача данных','Сервер-02',81,['Большой исходящий поток','Соединение с внешним адресом'],'Нетипичный объём исходящих данных.'),
 ('process','Подозрительный процесс','ПК-04',76,['Запуск неизвестного процесса','Изменение автозагрузки'],'Подозрительная последовательность процессов.'),
 ('lateral','Перемещение между устройствами','ПК-05',89,['Вход на ПК-05','Удалённый вход на Сервер-01','Удалённый вход на Сервер-02'],'Последовательность удалённых входов на разные узлы.'),
 ('defender','Отключение защиты','ПК-06',94,['Остановка защитного сервиса','Изменение параметров защиты'],'Попытка отключения средства защиты.'),
 ('complex','Комплексная атака','ПК-07',98,['Ошибки входа','Успешный вход','Повышение прав','Удалённый вход','Большой исходящий поток'],'Учебная цепочка из пяти подозрительных действий.')]

@asynccontextmanager
async def lifespan(app):
    if len(os.getenv('AUDIT_KEY','')) < 32:
        raise RuntimeError('AUDIT_KEY должен содержать не менее 32 символов')
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if not db.scalar(select(User).where(User.username=='admin')):
            pwd=os.getenv('ADMIN_PASSWORD','')
            if len(pwd)<12: raise RuntimeError('ADMIN_PASSWORD должен содержать не менее 12 символов')
            db.add(User(username='admin',password_hash=password_hash(pwd),role='admin'))
            db.commit()
    yield

app=FastAPI(title='AegisBorder SOC — учебная платформа',version='0.2.0',lifespan=lifespan)
static=Path(__file__).parent/'static'
app.mount('/static',StaticFiles(directory=static),name='static')
@app.get('/')
def home(): return FileResponse(static/'index.html')
@app.get('/api/v1/health')
def health(db:Session=Depends(get_db)):
    db.execute(select(func.count()).select_from(User)).scalar()
    return {'status':'ok','version':'0.2.0','database':'postgresql' if DB_URL.startswith('postgresql') else 'sqlite','mode':'synthetic-demo'}
class Login(BaseModel):
    username:str; password:str
@app.post('/api/v1/auth/login')
def login(data:Login,db:Session=Depends(get_db)):
    user=db.scalar(select(User).where(User.username==data.username))
    if not user or not verify_password(data.password,user.password_hash): raise HTTPException(401,'Неверный логин или пароль')
    raw=secrets.token_urlsafe(40)
    db.add(Token(user_id=user.id,digest=hashlib.sha256(raw.encode()).hexdigest(),expires=now()+timedelta(hours=8)))
    audit(db,user.username,'Вход в систему');db.commit()
    return {'token':raw,'username':user.username,'role':user.role}
@app.post('/api/v1/auth/logout')
def logout(authorization:str|None=Header(None),user:User=Depends(auth),db:Session=Depends(get_db)):
    db.execute(delete(Token).where(Token.digest==hashlib.sha256(authorization[7:].encode()).hexdigest()))
    audit(db,user.username,'Выход из системы');db.commit();return {'ok':True}
@app.get('/api/v1/auth/me')
def me(user:User=Depends(auth)): return {'username':user.username,'role':user.role}
@app.get('/api/v1/dashboard')
def dashboard(user:User=Depends(auth),db:Session=Depends(get_db)):
    risks=db.scalars(select(Incident.risk)).all()
    return {'events':db.scalar(select(func.count()).select_from(Event)),'incidents':len(risks),'risk':max(risks,default=0),'open_incidents':db.scalar(select(func.count()).select_from(Incident).where(Incident.status!='Закрыт'))}
@app.get('/api/v1/events')
def events(user:User=Depends(auth),db:Session=Depends(get_db)):
    return [{'id':x.id,'time':x.time.isoformat(),'source':x.source,'type':x.type,'severity':x.severity,'scenario':x.scenario,'detail':x.detail} for x in db.scalars(select(Event).order_by(Event.id.desc()).limit(500))]
@app.get('/api/v1/incidents')
def incidents(user:User=Depends(auth),db:Session=Depends(get_db)):
    return [{'id':x.id,'title':x.title,'risk':x.risk,'status':x.status,'explanation':x.explanation,'scenario':x.scenario,'created_at':x.created_at.isoformat()} for x in db.scalars(select(Incident).order_by(Incident.id.desc()))]
@app.get('/api/v1/scenarios')
def scenarios(user:User=Depends(auth)):
    return [{'id':x[0],'name':x[1],'description':x[5]} for x in SCENARIOS]
@app.post('/api/v1/scenarios/reset')
def reset(user:User=Depends(operator),db:Session=Depends(get_db)):
    db.execute(delete(Event));db.execute(delete(Incident));audit(db,user.username,'Сброс учебных событий и инцидентов');db.commit();return {'ok':True}

@app.post('/api/v1/scenarios/{scenario_id}')
def run_scenario(scenario_id:str,user:User=Depends(operator),db:Session=Depends(get_db)):
    scenario=next((x for x in SCENARIOS if x[0]==scenario_id),None)
    if not scenario: raise HTTPException(404,'Сценарий не найден')
    sid,name,source,risk,actions,explanation=scenario
    stamp=now()
    for index,action in enumerate(actions):
        db.add(Event(time=stamp+timedelta(seconds=index),source=source,type=action,severity='Критическая' if risk>=90 else 'Высокая',scenario=sid,detail='Синтетическое событие. Не относится к реальной инфраструктуре.'))
    inc=Incident(title=name,risk=risk,status='Новый',explanation=explanation,scenario=sid,created_at=stamp)
    db.add(inc);db.flush();audit(db,user.username,f'Запуск учебного сценария {sid}; инцидент #{inc.id}');db.commit()
    return {'id':inc.id,'title':name,'risk':risk}
class StatusUpdate(BaseModel):
    status:str
@app.patch('/api/v1/incidents/{incident_id}')
def update_incident(incident_id:int,data:StatusUpdate,user:User=Depends(operator),db:Session=Depends(get_db)):
    if data.status not in ('Новый','В работе','Устранён','Закрыт'): raise HTTPException(422,'Недопустимый статус')
    inc=db.get(Incident,incident_id)
    if not inc: raise HTTPException(404,'Инцидент не найден')
    inc.status=data.status;audit(db,user.username,f'Инцидент #{inc.id}: статус {data.status}');db.commit()
    return {'ok':True,'status':inc.status}
@app.get('/api/v1/audit')
def audit_list(user:User=Depends(auth),db:Session=Depends(get_db)):
    return [{'id':x.id,'time':x.time.isoformat(),'actor':x.actor,'action':x.action,'hash':x.record_hash[:16]} for x in db.scalars(select(Audit).order_by(Audit.id.desc()).limit(200))]
@app.get('/api/v1/audit/verify')
def audit_verify(user:User=Depends(auth),db:Session=Depends(get_db)):
    previous='0'*64
    for x in db.scalars(select(Audit).order_by(Audit.id)):
        payload=json.dumps([x.time.replace(tzinfo=timezone.utc).isoformat(),x.actor,x.action,previous],ensure_ascii=False,separators=(',',':'))
        expected=hmac.new(os.getenv('AUDIT_KEY','development-only-not-secure').encode(),payload.encode(),hashlib.sha256).hexdigest()
        if x.prev_hash!=previous or not hmac.compare_digest(x.record_hash,expected):return {'valid':False,'broken_id':x.id}
        previous=x.record_hash
    return {'valid':True,'records':db.scalar(select(func.count()).select_from(Audit))}
