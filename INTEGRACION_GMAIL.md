# 📧 Guía de Sincronización Automática con Bancos (Banreservas y Banco Popular)

Esta integración conecta tu correo **`josemcboss@gmail.com`** con tu perfil **Jose Mencia** en **Tracker de Gastos** de forma 100% gratuita y desatendida, capturando **únicamente consumos y débitos aprobados** de tus tarjetas y cuentas bancarias.

---

## 🛡️ Filtros de Seguridad y Precisión

1. **Solo Bancos Oficiales:** Únicamente lee notificaciones de:
   - **Banreservas:** `notificaciones@banreservas.com`
   - **Banco Popular:** `notificaciones@popularenlinea.com`
2. **Cero Publicidad / Promociones:** Ignora cualquier correo que contenga ofertas, cupones o promociones.
3. **Validación de Estatus:** Solo procesa transacciones marcadas expresamente como **`APROBADO`** o **`Aprobada`**.
4. **Extracción Exacta:**
   - **Comercio:** Extrae el establecimiento real (ej. `RUTH SNACK VM`, `RUTH SNACK VM DISTRITO NACIDO`).
   - **Monto y Moneda:** Extrae `RD$` / `DOP` / `US$`.
   - **Fecha:** Extrae la fecha real del comprobante bancario.

---

## 📋 Script Oficial para [script.google.com](https://script.google.com)

Copia y pega este código en tu proyecto de Google Apps Script:

```javascript
/**
 * Tracker de Gastos - Sincronizador Estricto Bancario
 * Propietario: Jose Mencia (josemcboss@gmail.com)
 * Bancos Soportados: Banreservas y Banco Popular Dominicano
 */

const API_URL = "https://tracker-gastos-api-97jh.onrender.com/api/integrations/email-expense";
const API_KEY = "trk_5946ff75771bc417c3c718bdeb5ea42b5d04a6c294807927";
const OWNER_EMAIL = "josemcboss@gmail.com";
const PROCESSED_LABEL = "Gastos/Procesado";

// Búsqueda estricta: Solo notificaciones de consumo de Banreservas y Banco Popular
const SEARCH_QUERY = 'label:inbox -label:"Gastos/Procesado" (from:notificaciones@banreservas.com OR from:notificaciones@popularenlinea.com) (subject:"Notificación de Consumo" OR subject:"Notificaciones Banreservas")';

function sincronizarGastosDesdeGmail() {
  let label = GmailApp.getUserLabelByName(PROCESSED_LABEL);
  if (!label) label = GmailApp.createLabel(PROCESSED_LABEL);

  const threads = GmailApp.search(SEARCH_QUERY, 0, 20);
  if (threads.length === 0) {
    Logger.log("No hay consumos bancarios nuevos pendientes.");
    return;
  }

  Logger.log(`Procesando ${threads.length} hilos de consumos bancarios...`);

  for (const thread of threads) {
    for (const msg of thread.getMessages()) {
      const options = {
        method: "post",
        contentType: "application/json",
        headers: { "x-api-key": API_KEY },
        payload: JSON.stringify({
          from: msg.getFrom(),
          subject: msg.getSubject(),
          bodyText: msg.getPlainBody(),
          bodyHtml: msg.getBody(),
          date: msg.getDate().toISOString(),
          ownerEmail: OWNER_EMAIL
        }),
        muteHttpExceptions: true
      };

      try {
        const res = UrlFetchApp.fetch(API_URL, options);
        const code = res.getResponseCode();

        // 201: Gasto registrado exitosamente
        // 422: Correo bancario sin consumo financiero aprobado (se etiqueta para no reintentar)
        if (code === 201 || code === 422) {
          thread.addLabel(label);
          Logger.log(`✅ Procesado: ${msg.getSubject()}`);
        } else {
          Logger.log(`⚠️ Servidor respondió con código ${code}: ${res.getContentText()}`);
        }
      } catch (e) {
        Logger.log(`❌ Error de conexión: ${e.message}`);
      }
    }
  }
}
```

---

## 🔄 ¿Cómo reprocesar los correos de prueba que ya tienen la etiqueta?

Si algún correo que quieres registrar ya tiene la etiqueta `Gastos/Procesado` en Gmail:
1. En Gmail, abre ese correo o selecciónalo en la lista.
2. Quítale la etiqueta **`Gastos/Procesado`** (o en la barra izquierda de Gmail, entra a la etiqueta y elimínala).
3. Vuelve a Google Apps Script y haz clic en **"Ejecutar"**. Se registrarán con el nuevo formato limpio y exacto.
