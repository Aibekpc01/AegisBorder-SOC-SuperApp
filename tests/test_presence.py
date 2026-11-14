# Назначение файла: Проверяет подсистему presence. Содержит проверки ожидаемого поведения, а не код рабочего сервера.
# Карта проекта: SOURCE_GUIDE.md; обзор папки: FOLDER_GUIDE.md.

from datetime import timedelta

from sqlalchemy import select

from app.command.models import Incident, SiteVisit, User, utcnow


def test_devices_persist_and_expire(admin):
    response = admin.post('/api/v1/presence/heartbeat', headers={'user-agent': 'Mozilla/5.0 (iPhone) AppleWebKit Safari/604.1'})
    assert response.status_code == 200
    row = admin.get('/api/v1/presence/devices').json()['devices'][0]
    assert row['device'] == 'iPhone' and row['online']
    with admin.factory() as db:
        visit = db.scalar(select(SiteVisit))
        visit.last_seen = utcnow() - timedelta(seconds=76)
        db.commit()
    assert not admin.get('/api/v1/presence/devices').json()['devices'][0]['online']
    admin.post('/api/v1/presence/heartbeat')
    assert admin.get('/api/v1/presence/devices').json()['devices'][0]['online']
    admin.post('/api/v1/auth/logout')
    admin.post('/api/v1/auth/login', json={'username': 'admin', 'password': 'test-admin-password-123'})
    row = admin.get('/api/v1/presence/devices').json()['devices'][0]
    assert row['device'] == 'iPhone' and not row['online']


def test_guests_visible_but_device_ips_private(admin, monkeypatch):
    monkeypatch.setenv('PUBLIC_DEMO_MODE', 'true')
    admin.post('/api/v1/presence/heartbeat')
    guest = admin.post('/api/v1/auth/demo-viewer').json()
    assert admin.post('/api/v1/presence/heartbeat').status_code == 200
    members = admin.get('/api/v1/presence/participants').json()['members']
    assert len(members) >= 2
    assert any(m['id'] == guest['id'] and m['online'] for m in members)
    assert all('ip' not in m for m in members)
    devices = admin.get('/api/v1/presence/devices').json()
    assert devices['scope'] == 'own'
    assert all(row['user_id'] == guest['id'] for row in devices['devices'])
    assert admin.patch('/api/v1/presence/employees/1', json={'full_name':'X','position':'X','department':'X'}).status_code == 403
    with admin.factory() as db:
        incidents = list(db.scalars(select(Incident).where(Incident.owner_id == guest['id'])))
        assert len(incidents) >= 3
        assert all(i.demo_id is not None for i in incidents)
    other = admin.post('/api/v1/auth/demo-viewer').json()
    with admin.factory() as db:
        assert len(list(db.scalars(select(Incident).where(Incident.owner_id == other['id'])))) >= 3
    assert admin.post('/api/v1/auth/logout').status_code == 200
    admin.post('/api/v1/auth/login', json={'username':'admin','password':'test-admin-password-123'})
    assert len(admin.get('/api/v1/presence/devices').json()['devices']) == 2


def test_employee_edit_admin_only(admin):
    with admin.factory() as db:
        user_id = db.scalar(select(User.id).where(User.username == 'admin'))
    body = {'full_name': 'Сотрудник', 'department': 'Аналитика', 'position': 'Аналитик'}
    assert admin.patch(f'/api/v1/presence/employees/{user_id}', json=body).status_code == 200
    row = next(m for m in admin.get('/api/v1/presence/participants').json()['members'] if m['id'] == user_id)
    assert row['full_name'] == 'Сотрудник'
    assert admin.patch(f'/api/v1/presence/employees/{user_id}', json={**body,'role':'admin'}).status_code == 422
