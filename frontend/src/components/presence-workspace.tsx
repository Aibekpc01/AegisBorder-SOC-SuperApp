import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Users, Monitor, Smartphone, Search, Wifi, Clock, Pencil, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";
import { Dialog } from "./ui/dialog";
import { api } from "../api";
import { roles } from "../lib/utils";
import "../presence.css";

type Member = { id: number; username: string; full_name: string; department: string; position: string; role: string; active: boolean; online: boolean; guest: boolean; last_seen: string | null };
type Device = { id: string; username: string; device: string; browser: string; ip: string; first_seen: string; last_seen: string; online: boolean };
const stamp = (value: string | null) => value ? new Date(value.match(/Z$|[+-]\d\d:\d\d$/) ? value : value + "Z").toLocaleString("ru-RU") : "Ещё не подключался";

export function PresenceSignal({ userId }: { userId: number }) {
  useEffect(() => {
    let alive = true;
    const beat = () => { if (alive && navigator.onLine) void api("/presence/heartbeat", "POST", {}).catch(() => {}); };
    beat();
    const timer = window.setInterval(beat, 25000);
    window.addEventListener("online", beat);
    window.addEventListener("pageshow", beat);
    return () => { alive = false; clearInterval(timer); window.removeEventListener("online", beat); window.removeEventListener("pageshow", beat); };
  }, [userId]);
  return null;
}

export function PresenceBadge({ online }: { online: boolean }) {
  return <span className={`presence-badge ${online ? "is-online" : "is-offline"}`}><i />{online ? "Онлайн" : "Офлайн"}</span>;
}

export function Participants({ admin }: { admin: boolean }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [edit, setEdit] = useState<Member | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["participants"], queryFn: () => api<{members: Member[]}>("/presence/participants"), refetchInterval: 15000 });
  const rows = query.data?.members || [];
  const filtered = rows.filter(m => (filter !== "online" || m.online) && (filter !== "staff" || !m.guest) && (filter !== "guests" || m.guest) && `${m.username} ${m.full_name} ${m.department} ${m.position}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <section className="presence-workspace">
    <header className="presence-hero"><div><span className="eyebrow">ЛЮДИ И ВЗАИМОДЕЙСТВИЕ</span><h2><Users /> Участники</h2><p>Сотрудники, тестовые аккаунты и гости демонстрации — в одном пространстве. Узнайте, кто сейчас на связи, и перейдите к обсуждению.</p></div><Link className="btn btn-outline" to="/app/team">Открыть чат <ArrowRight size={16}/></Link></header>
    <div className="presence-metrics"><article><Wifi/><strong>{rows.filter(m=>m.online).length}</strong><span>Сейчас онлайн</span></article><article><ShieldCheck/><strong>{rows.filter(m=>!m.guest).length}</strong><span>Сотрудников</span></article><article><Users/><strong>{rows.filter(m=>m.guest).length}</strong><span>Демогостей</span></article></div>
    <div className="presence-toolbar"><label><Search size={18}/><input aria-label="Поиск участников" placeholder="Имя, должность, подразделение" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="presence-tabs">{[["all","Все"],["online","Онлайн"],["staff","Сотрудники"],["guests","Демогости"]].map(([key,label])=><button key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}</div></div>
    <p className="presence-help"><Clock size={15}/> Обновление каждые 15 секунд. После закрытия сайта или потери связи статус меняется в течение 75 секунд. Карточки сотрудников редактирует администратор.</p>
    {query.isPending && <p role="status">Загружаем участников…</p>}{query.error && <p role="alert">{query.error.message}</p>}
    <div className="presence-grid">{filtered.map(member=><article className="presence-card" key={member.id}><div className="row between"><span className={`presence-avatar ${member.guest ? "guest" : ""}`}>{(member.full_name || member.username).slice(0,2).toUpperCase()}</span><PresenceBadge online={member.online}/></div><h3>{member.full_name || member.username}</h3><span className="badge">{roles[member.role] || member.role}</span><p>{member.guest ? "Личная демонстрационная среда" : member.position || "Должность не указана"}</p><small>{member.department || (member.guest ? "Учебные данные изолированы от других гостей" : "Подразделение не указано")}</small><footer><span>{!member.active ? "Аккаунт отключён" : member.online ? "Подключён к сайту" : `Последняя связь: ${stamp(member.last_seen)}`}</span>{admin && !member.guest && <button className="btn btn-outline" aria-label={`Редактировать ${member.username}`} onClick={()=>{setEdit(member);setError("");}}><Pencil size={14}/> Изменить</button>}</footer></article>)}</div>
    {!query.isPending && !filtered.length && <div className="presence-empty">Участники не найдены. Попробуйте другой запрос или фильтр.</div>}
    {admin && <Link className="btn btn-outline" to="/app/users">Создать сотрудника или настроить права <ArrowRight size={15}/></Link>}
    {edit && <Dialog open={true} title="Карточка сотрудника" onClose={()=>{if(!busy)setEdit(null);}}><section className="presence-dialog"><p>{edit.username} · {roles[edit.role]}</p><form onSubmit={async e=>{e.preventDefault();setBusy(true);try{await api(`/presence/employees/${edit.id}`,"PATCH",{full_name:edit.full_name,department:edit.department,position:edit.position});await client.invalidateQueries({queryKey:["participants"]});setEdit(null);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>{([['full_name','ФИО',160],['position','Должность',120],['department','Подразделение',120]] as const).map(([key,label,max])=><label key={key}>{label}<input autoFocus={key==="full_name"} maxLength={max} value={edit[key]} onChange={e=>setEdit({...edit,[key]:e.target.value})}/></label>)}{error&&<p role="alert">{error}</p>}<div className="row"><button className="btn" disabled={busy}>Сохранить</button><button type="button" className="btn btn-outline" disabled={busy} onClick={()=>setEdit(null)}>Отмена</button></div></form></section></Dialog>}
  </section>;
}

export function Devices() {
  const [search,setSearch]=useState("");
  const [online,setOnline]=useState(false);
  const query=useQuery({queryKey:["site-devices"],queryFn:()=>api<{devices:Device[];scope:string}>("/presence/devices"),refetchInterval:15000});
  const rows=query.data?.devices || [];
  const filtered=rows.filter(d=>(!online||d.online)&&`${d.device} ${d.browser} ${d.ip} ${d.username}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="presence-workspace"><header className="presence-hero"><div><span className="eyebrow">ИСТОРИЯ ПОДКЛЮЧЕНИЙ</span><h2><Monitor/> Устройства</h2><p>Реальные подключения к сайту: телефоны, планшеты и компьютеры. История сеансов сохраняется после выхода.</p></div><span className="presence-badge is-online"><Wifi size={14}/>{rows.filter(d=>d.online).length} онлайн</span></header><div className="presence-toolbar"><label><Search size={18}/><input aria-label="Поиск устройств" placeholder="Устройство, IP, браузер или участник" value={search} onChange={e=>setSearch(e.target.value)}/></label><button className="btn btn-outline" aria-pressed={online} onClick={()=>setOnline(!online)}>{online?"Показать всю историю":"Только онлайн"}</button></div><p className="presence-help">{query.data?.scope==="all"?"Администратору доступны подключения всех участников.":"Здесь показаны ваши подключения. Полная история с IP-адресами доступна администратору."} Название определяется браузером; точная модель и имя компьютера могут быть недоступны. IP — адрес подключения, а не физическое местоположение.</p>{query.isPending&&<p role="status">Загрузка устройств…</p>}{query.error&&<p role="alert">{query.error.message}</p>}<div className="presence-grid">{filtered.map(d=><article key={d.id} className="presence-card device-card"><div className="row between"><span className="presence-avatar">{/iPhone|iPad|Android/.test(d.device)?<Smartphone/>:<Monitor/>}</span><PresenceBadge online={d.online}/></div><h3>{d.device}</h3><p>{d.browser} · {d.username}</p><dl><dt>Последний IP</dt><dd>{d.ip}</dd><dt>Начало сеанса</dt><dd>{stamp(d.first_seen)}</dd><dt>Последняя связь</dt><dd>{stamp(d.last_seen)}</dd></dl><footer><Clock size={14}/> {d.online?"Сайт открыт на устройстве":"Сеанс сохранён в истории"}</footer></article>)}</div>{!query.isPending&&!filtered.length&&<div className="presence-empty">Подключения появятся автоматически после первого сигнала от сайта. Обновление каждые 15 секунд.</div>}<p className="presence-help">Один вход — одна запись истории. Несколько вкладок одного сеанса учитываются вместе. Офлайн определяется через 75 секунд без сигнала; выход из аккаунта завершает статус сразу.</p></section>;
}

export function DemoWelcome() {
  return <section className="demo-welcome"><div><Sparkles/><span className="eyebrow">ВАША ЛИЧНАЯ ДЕМОНСТРАЦИЯ</span></div><h2>От первого сигнала — к расследованию</h2><p>Для нового гостя уже подготовлены три учебных примера: подбор пароля, доступ к закрытому ресурсу и неизвестное USB-устройство. Откройте инцидент, изучите события и проверьте, почему система рассчитала такой риск.</p><div className="demo-steps"><Link to="/app/incidents"><b>01</b><span>Изучите инциденты<small>События, причины и оценка риска</small></span><ArrowRight/></Link><Link to="/app/scenarios"><b>02</b><span>Запустите сценарий<small>Посмотрите, как появляются сигналы</small></span><ArrowRight/></Link><Link to="/app/participants"><b>03</b><span>Познакомьтесь с участниками<small>Кто сейчас на связи</small></span><ArrowRight/></Link></div><small>Это синтетические примеры, а не реальные атаки. Ваши учебные инциденты видны только в вашей среде. Действия с постоянными данными ограничены вашей ролью.</small></section>;
}
