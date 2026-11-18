# 📧 Guía de Sincronización Automática con Gmail

Esta guía te permite conectar tu correo **`josemcboss@gmail.com`** con tu perfil **Jose Mencia** en **Tracker de Gastos** de forma 100% gratuita y desatendida.

---

## 🛠️ ¿Cómo funciona?

1. Cuando recibes una notificación de compra por correo (Banco Popular, Banreservas, BHD, Uber, PedidosYa, etc.), Google Apps Script la detecta.
2. El script envía el contenido al endpoint seguro `POST /api/integrations/email-expense`.
3. El backend:
   - Identifica tu usuario mediante tu `x-api-key`.
   - Extrae el monto, moneda (RD$ o US$), comercio y fecha con el **Parser Inteligente**.
   - Si el formato es atípico o complejo, utiliza el **Fallback con Gemini AI**.
   - Asigna la categoría adecuada automáticamente (Comida, Transporte, etc.).
   - Inserta el gasto en tu base de datos de Neon PostgreSQL.
   - Si tienes Telegram vinculado, te envía una confirmación inmediata con el detalle.
4. El script en Gmail marca el correo con la etiqueta **`Gastos/Procesado`** para no volver a registrarlo.

---

## 🚀 Paso a Paso para Activar la Sincronización en tu Gmail

### Paso 1: Abrir Google Apps Script
1. Inicia sesión en tu cuenta **`josemcboss@gmail.com`**.
2. Entra a [https://script.google.com](https://script.google.com) y haz clic en **"Nuevo proyecto"**.
3. Nómbralo: `Tracker de Gastos - Sync`.

### Paso 2: Pegar el Código del Script
Borra el contenido predeterminado y pega el siguiente código:

```javascript
/**
 * Tracker de Gastos - Sincronizador Automático de Gmail
 * Propietario: Jose Mencia (josemcboss@gmail.com)
 */

// URL de tu backend en Render en producción:
const API_URL = "https://tracker-gastos-api-97jh.onrender.com/api/integrations/email-expense";

// Tu API Key personal (asociada a tu perfil Jose Mencia):
const API_KEY = "trk_5946ff75771bc417c3c718bdeb5ea42b5d04a6c294807927";

// Etiqueta para marcar correos ya procesados y evitar duplicados:
const PROCESSED_LABEL_NAME = "Gastos/Procesado";

// Filtro de búsqueda en Gmail:
const GMAIL_SEARCH_QUERY = 'label:inbox -label:"Gastos/Procesado" (from:bancopopular.com.do OR from:banreservas.com.do OR from:bhd.com.do OR from:scotiabank.com.do OR from:qik.do OR from:uber.com OR from:pedidosya.com OR from:apple.com OR subject:"aviso de retiro" OR subject:"notificación de consumo" OR subject:"compra aprobada" OR subject:"tu recibo")';

function sincronizarGastosDesdeGmail() {
  let label = GmailApp.getUserLabelByName(PROCESSED_LABEL_NAME);
  if (!label) {
    label = GmailApp.createLabel(PROCESSED_LABEL_NAME);
  }

  const threads = GmailApp.search(GMAIL_SEARCH_QUERY, 0, 15);
  if (threads.length === 0) {
    Logger.log("No se encontraron correos nuevos para procesar.");
    return;
  }

  Logger.log("Procesando " + threads.length + " correos...");

  for (const thread of threads) {
    const messages = thread.getMessages();
    for (const msg of messages) {
      const subject = msg.getSubject();
      const from = msg.getFrom();
      const date = msg.getDate().toISOString();
      const plainBody = msg.getPlainBody();

      const payload = {
        from: from,
        subject: subject,
        bodyText: plainBody,
        date: date,
        ownerEmail: "josemcboss@gmail.com"
      };

      const options = {
        method: "post",
        contentType: "application/json",
        headers: {
          "x-api-key": API_KEY
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      try {
        const response = UrlFetchApp.fetch(API_URL, options);
        const code = response.getResponseCode();
        const responseText = response.getContentText();

        if (code === 200 || code === 201) {
          Logger.log("✅ Gasto registrado: " + subject);
          thread.addLabel(label);
        } else if (code === 422) {
          Logger.log("ℹ️ Correo sin transacción de gasto: " + subject);
          thread.addLabel(label);
        } else {
          Logger.log("⚠️ Error " + code + ": " + responseText);
        }
      } catch (err) {
        Logger.log("❌ Error de red: " + err.message);
      }
    }
  }
}
```

### Paso 3: Configurar el Disparador Automático (Trigger)
1. En el menú lateral izquierdo de Google Apps Script, haz clic en el icono del **Reloj** (**Disparadores** o *Triggers*).
2. Haz clic en **"Añadir activador"** (abajo a la derecha).
3. Configura:
   - **Función que se ejecutará:** `sincronizarGastosDesdeGmail`.
   - **Selecciona la fuente del evento:** `Basado en tiempo`.
   - **Tipo de temporizador:** `Temporizador por minutos`.
   - **Selecciona el intervalo de minutos:** `Cada 5 minutos` (o `Cada 10 minutos`).
4. Haz clic en **Guardar** y autoriza los permisos solicitados por tu propia cuenta de Google.

¡Listo! A partir de ese momento, cualquier notificación bancaria o factura que llegue a tu correo se registrará en tu Tracker de Gastos automáticamente.
