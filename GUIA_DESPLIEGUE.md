# 🚀 Guía de Despliegue a Producción (Vercel + Render + PostgreSQL)

Esta guía paso a paso te explica cómo poner tu aplicación de **Tracker de Gastos (Full-Stack PWA)** en producción de forma 100% gratuita utilizando las plataformas más modernas y confiables:

- **Frontend:** [Vercel](https://vercel.com) (CDN global, SSL automático, rendimiento ultra rápido y soporte PWA para iPhone).
- **Backend:** [Render](https://render.com) (Servidor Node.js Express).
- **Base de Datos:** [Neon](https://neon.tech) o [Supabase](https://supabase.com) (PostgreSQL en la nube con capa gratuita para que tus datos nunca se borren).

---

## 📌 Arquitectura

```
┌─────────────────────────────────┐
│     iPhone / Navegador Web      │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│      Frontend (Vercel)          │  PWA instalable, React 19 + Vite
│  https://mi-tracker.vercel.app  │  Enruta llamadas a la API
└───────────────┬─────────────────┘
                │ /api/*
                ▼
┌─────────────────────────────────┐
│       Backend (Render)          │  Express.js, JWT Auth, REST API
│  https://tracker-api.onrender   │
└───────────────┬─────────────────┘
                │ Prisma ORM
                ▼
┌─────────────────────────────────┐
│  PostgreSQL (Neon / Supabase)   │  Almacenamiento persistente
└─────────────────────────────────┘
```

> **¿Por qué PostgreSQL en vez de SQLite para producción?**  
> En el plan gratuito de Render los servidores entran en reposo y el disco es efímero (se borra con cada despliegue o reinicio). Con un PostgreSQL gratuito en Neon o Supabase tus datos quedan guardados para siempre.

---

## 🛠️ Paso 0: Subir tu Código a GitHub

1. Abre tu terminal en la carpeta principal del proyecto (`c:\Users\Administrator\Tracker de gastos`).
2. Inicializa git y realiza tu primer commit:
   ```powershell
   git init
   git add .
   git commit -m "feat: initial commit ready for production"
   ```
3. Crea un repositorio nuevo en [GitHub](https://github.com/new) (puede ser Privado o Público).
4. Vincula tu repositorio local con GitHub y sube los cambios:
   ```powershell
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   git push -u origin main
   ```

---

## 🗄️ Paso 1: Crear la Base de Datos PostgreSQL (Gratis)

Recomendamos **Neon.tech** (es instantáneo y no pide tarjeta):

1. Regístrate gratis en [Neon.tech](https://neon.tech).
2. Crea un nuevo proyecto (por ejemplo: `tracker-gastos-db`).
3. En el panel principal copia la cadena de conexión **Connection string** (formato `postgresql://...`).
4. **Configura Prisma para PostgreSQL:**
   En el archivo `server/prisma/schema.prisma`, cambia:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
   *(Haz commit y push de este cambio a GitHub cuando vayas a desplegar a Render).*

---

## ⚙️ Paso 2: Desplegar el Backend en Render

1. Regístrate o inicia sesión en [Render.com](https://render.com).
2. Haz clic en **New +** y selecciona **Web Service**.
3. Selecciona **Build and deploy from a Git repository** y conecta tu repositorio de GitHub.
4. Configura los siguientes campos:
   - **Name:** `tracker-gastos-api` (o el nombre que prefieras).
   - **Region:** Elige la más cercana (ej. *Ohio (US East)* o *Oregon*).
   - **Branch:** `main`.
   - **Root Directory:** `server` ⚠️ *(muy importante)*.
   - **Runtime:** `Node`.
   - **Build Command:** 
     ```bash
     npm install && npx prisma db push && npm run build
     ```
   - **Start Command:**
     ```bash
     npm run start
     ```
   - **Instance Type:** `Free`.

5. En la sección **Environment Variables**, añade:
   | Clave | Valor |
   |---|---|
   | `DATABASE_URL` | Tu conexión de Neon (`postgresql://...`) |
   | `JWT_SECRET` | Una cadena secreta larga y aleatoria (ej: `super_clave_secreta_prod_2026_xyz`) |
   | `CLIENT_URL` | `http://localhost:5173` *(luego añadiremos el link de Vercel)* |
   | `NODE_ENV` | `production` |

6. Haz clic en **Deploy Web Service**.
7. Espera unos 2-3 minutos hasta que veas el mensaje `Your service is live 🎉`.
8. Copia la URL de tu API de Render (ejemplo: `https://tracker-gastos-api.onrender.com`).

---

## 🌐 Paso 3: Desplegar el Frontend en Vercel

1. Inicia sesión en [Vercel](https://vercel.com).
2. Haz clic en **Add New...** ➜ **Project**.
3. Importa tu repositorio de GitHub.
4. En la pantalla de configuración:
   - **Framework Preset:** `Vite`.
   - **Root Directory:** Haz clic en *Edit* y selecciona la carpeta `client` ⚠️ *(muy importante)*.
   - **Build Command:** `npm run build` *(por defecto)*.
   - **Output Directory:** `dist` *(por defecto)*.
5. Despliega la pestaña **Environment Variables** y agrega:
   | Name | Value |
   |---|---|
   | `VITE_API_URL` | La URL de tu API de Render con `/api` al final (ej: `https://tracker-gastos-api.onrender.com/api`) |
6. Haz clic en **Deploy**.
7. Vercel compilará la aplicación y en ~1 minuto tendrás tu dominio en producción (ejemplo: `https://tracker-gastos.vercel.app`).

> ℹ️ **Nota sobre rutas y recarga:** Ya dejamos configurado `client/vercel.json` con la regla de rewrites para que React Router funcione perfecto al recargar en `/dashboard` o `/categories`.

---

## 🔄 Paso 4: Conectar CORS entre Render y Vercel

Para que el backend acepte peticiones de tu nuevo dominio en Vercel:

1. Ve a tu servicio en [Render](https://dashboard.render.com).
2. Entra en **Environment**.
3. Edita la variable `CLIENT_URL` para incluir tu dominio de Vercel:
   ```
   https://tu-app-de-gastos.vercel.app,http://localhost:5173
   ```
4. Guarda los cambios. Render reiniciará automáticamente el servicio con el nuevo permiso CORS.

---

## 📱 Paso 5: Instalar la PWA en tu iPhone

1. Abre **Safari** en tu iPhone.
2. Ingresa a la URL de Vercel: `https://tu-app-de-gastos.vercel.app`.
3. Toca el botón **Compartir** (icono de cuadrado con flecha hacia arriba en la barra inferior).
4. Desplázate hacia abajo y selecciona **"Agregar a Inicio"** (*Add to Home Screen*).
5. Confirma el nombre (ej. **"Gastos"**) y presiona **Agregar**.
6. ¡Listo! Se abrirá como una aplicación nativa, a pantalla completa y con el ícono y tema configurados.
