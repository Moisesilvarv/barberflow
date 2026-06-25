# BarberFlow Deploy Checklist

## Backend

1. Configure environment variables from `backend/.env.example`.
2. Install dependencies:

```bash
pip install -r backend/requirements.txt
```

3. Run database migrations:

```bash
python backend/manage.py migrate
```

4. Collect static files:

```bash
python backend/manage.py collectstatic --noinput
```

5. Start production server:

```bash
gunicorn barberflow.wsgi:application --chdir backend
```

## Frontend

1. Configure `frontend/.env` using `frontend/.env.example`.
2. Build the app:

```bash
cd frontend
npm install
npm run build
```

3. Deploy `frontend/dist` to Render Static Site, Railway static hosting, Nginx, or another static host.

## Required Production Values

- `DEBUG=False`
- Strong `SECRET_KEY`
- `ALLOWED_HOSTS` with the backend domain
- `CORS_ALLOWED_ORIGINS` with the frontend domain
- `VITE_API_URL` pointing to the backend `/api`
- Managed PostgreSQL through `DATABASE_URL`

## Final Smoke Test

- Register a barbershop
- Log in
- Create an appointment from `/agenda`
- Open `/public/{barbershop_id}`
- Create a public appointment
- Confirm each barbershop only sees its own appointments
