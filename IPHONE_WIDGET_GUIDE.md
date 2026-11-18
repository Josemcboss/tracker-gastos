# 📱 Guía: Widget de Gastos y Atajo para iPhone (iOS)

Esta guía te permite ver en tiempo real tu gasto mensual, presupuesto restante y último consumo en un **Widget o Notificación de tu iPhone** usando la app nativa **Atajos (Apple Shortcuts)**.

---

## 🔗 Endpoint de Datos
Tu backend en producción entrega tus finanzas en formato ligero para iOS en la siguiente dirección:

```text
https://tracker-gastos-api-97jh.onrender.com/api/integrations/widget-summary?token=trk_5946ff75771bc417c3c718bdeb5ea42b5d04a6c294807927
```

---

## 🛠️ Cómo crear el Atajo en tu iPhone (Paso a Paso en 1 minuto)

1. Abre la aplicación **Atajos** (*Shortcuts*) en tu iPhone.
2. Toca el botón **`+`** (arriba a la derecha) para crear un nuevo atajo.
3. Nómbralo: **"Mis Gastos"** (puedes ponerle icono de billetera 💳).
4. Agrega las siguientes 3 acciones:
   
   - **Acción 1:** Busca `Obtener contenido de URL` (*Get Contents of URL*).
     - Pega la URL:  
       `https://tracker-gastos-api-97jh.onrender.com/api/integrations/widget-summary?token=trk_5946ff75771bc417c3c718bdeb5ea42b5d04a6c294807927`
   
   - **Acción 2:** Busca `Obtener valor del diccionario` (*Get Dictionary Value*).
     - Clave: `totalSpentFormatted`
   
   - **Acción 3:** Busca `Mostrar notificación` (*Show Notification*).
     - Texto:
       ```text
       💳 Gastado este mes: [totalSpentFormatted]
       🎯 Presupuesto libre: [Obtener valor: budgetRemainingFormatted]
       🛒 Último gasto: [Obtener valor: lastExpense.description]
       ```

5. Toca **Listo**.

---

## 📲 Cómo poner el Widget en tu Pantalla de Inicio o Bloqueo
1. Mantén presionada la pantalla de inicio de tu iPhone hasta que los iconos tiemblen.
2. Toca el botón **`+`** arriba a la izquierda.
3. Busca **Atajos** (*Shortcuts*).
4. Selecciona el widget y elige tu atajo **"Mis Gastos"**.
5. ¡Listo! Con solo tocar el widget verás tus finanzas actualizadas en segundos sin tener que abrir el navegador.
