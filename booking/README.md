# Reservas de coaching de Ubaman

Este proyecto añade un calendario propio con pago alojado en Stripe, correos de confirmación y archivos `.ics`. La dirección pública es https://reservas.ubaman.com y el Worker está configurado en modo Stripe `live`.

## Dominio de reservas

- `PUBLIC_ORIGIN` define la dirección pública, los retornos de Checkout y el hostname de Turnstile. El widget debe autorizar `reservas.ubaman.com`.
- El dominio personalizado está declarado en `wrangler.jsonc`. `run_worker_first` permite redirigir las páginas antes de servir los archivos estáticos.
- `LEGACY_ORIGIN` conserva temporalmente el dominio anterior. Las visitas GET/HEAD a sus páginas se redirigen al nuevo dominio manteniendo ruta y parámetros. El navegador conserva el fragmento de los enlaces privados de resultado.
- Los endpoints `/api/*` no se redirigen. El webhook existente de Stripe sigue funcionando en la dirección anterior con verificación de firma. Mantener `workers_dev` activo hasta actualizar el destino en Stripe y comprobar sus entregas.
- Las nuevas reservas y consultas desde el navegador utilizan el origen público; la migración no amplía los orígenes autorizados ni cambia las claves.

## Precios y funcionamiento

| Plan | Total USD | Duración | Descuento del paquete |
| --- | ---: | --- | ---: |
| 1 sesión | 40 | 60 minutos | — |
| 3 sesiones | 96 | 3 × 60 minutos | 20% |
| 5 sesiones | 160 | 5 × 60 minutos | 20% |

Se eligen todas las fechas antes de pagar; pueden ser independientes. Stripe Checkout recibe un único importe por el paquete, calculado exclusivamente en el servidor. Esta versión permite tarjeta y las carteras compatibles que Stripe muestre para ese dispositivo/cuenta; no incluye métodos de confirmación diferida como transferencias o cupones. No se puede garantizar que Apple Pay aparezca en todos los equipos.

Horario inicial **por confirmar con Ubaman**: todos los días 09:00–17:00, zona `America/Mexico_City`, 60 minutos por sesión, 30 minutos entre sesiones, aviso mínimo de 2 horas, horizonte de 14 días y máximo de 3 sesiones por día. La zona NO se deduce del correo o del país. Si corresponde a Sonora, usar `America/Hermosillo`. El comprador ve las fechas en la zona de su navegador; los correos identifican explícitamente la zona del coach y el `.ics` usa UTC.

## Configuración por etapas, planes gratuitos

1. Crear una cuenta de Cloudflare con Workers Free y una base D1. No hace falta transferir el dominio de GoDaddy ni cambiar sus servidores DNS: se puede empezar con el subdominio `workers.dev` que proporciona Cloudflare.
2. En una computadora con Node 22.13 o superior, abrir esta carpeta y ejecutar:

   ```sh
   npx wrangler@4 login
   npx wrangler@4 d1 create ubaman-booking
   ```

   Copiar `database_id` en `wrangler.jsonc`. Ejecutar:

   ```sh
   npx wrangler@4 d1 execute ubaman-booking --remote --file schema.sql
   npx wrangler@4 deploy
   ```

   Este primer despliegue mantiene `BOOKING_ENABLED=false`: no acepta reservas ni pagos.
3. Copiar la URL HTTPS real del Worker a `PUBLIC_ORIGIN`, sin barra final. Crear un widget Turnstile gratuito para **ese hostname**, añadir la clave pública a `TURNSTILE_SITE_KEY` y guardar la clave secreta como secreto del Worker.
4. Crear una cuenta Resend Free y verificar un dominio remitente, por ejemplo `avisos.ubaman.com`, añadiendo **solo los registros que Resend indique** en GoDaddy. No reemplazar los A/CNAME que sirven la web. Definir `EMAIL_FROM` (ejemplo: `Ubaman <reservas@avisos.ubaman.com>`) y **confirmar con Ubaman el correo receptor** antes de establecer `COACH_EMAIL`. Nunca usar las direcciones de ejemplo para producción.
5. En Stripe, empezar en modo de prueba. Crear un destino webhook a `https://TU-WORKER.workers.dev/api/webhook` para `checkout.session.completed` y `checkout.session.expired`. Opcionalmente también los eventos `checkout.session.async_payment_succeeded` y `checkout.session.async_payment_failed`, aunque esta versión solo ofrece pagos inmediatos. Guardar la clave API de prueba y el secreto de firma del destino. **El Payment Link antiguo no se reutiliza**: cada pedido genera su propia sesión Checkout con los horarios vinculados.
6. Configurar los secretos en Cloudflare, Settings → Variables and Secrets, o mediante los comandos interactivos siguientes. No pegarlos en GitHub ni en el chat:

   ```sh
   npx wrangler@4 secret put STRIPE_SECRET_KEY
   npx wrangler@4 secret put STRIPE_WEBHOOK_SECRET
   npx wrangler@4 secret put RESEND_API_KEY
   npx wrangler@4 secret put TURNSTILE_SECRET_KEY
   npx wrangler@4 secret put ADMIN_TOKEN
   npx wrangler@4 secret put EMAIL_FROM
   npx wrangler@4 secret put COACH_EMAIL
   ```

   `ADMIN_TOKEN` debe ser una contraseña aleatoria de al menos 32 caracteres, guardada en tu gestor de contraseñas. Los archivos `.dev.vars` son solo para pruebas locales y se excluyen de git. No añadir nunca tarjetas ni claves reales al repositorio.
7. Confirmar zona horaria y correo del coach. Establecer `BOOKING_ENABLED=true` en el archivo y desplegar **aún con Stripe de prueba**. Comprobar el circuito completo antes de colocar el enlace en la web pública. El panel `/admin.html` usa la clave solo en memoria, sin guardarla en el navegador.
8. Tras las pruebas, usar **otro Worker y otra base D1 para producción**, con las claves live y el webhook live correspondientes. No reutilizar reservas ficticias ni correos de prueba. Se pueden usar dos bases gratuitas dentro de los límites del proveedor. Configurar Turnstile para el hostname definitivo, repetir el despliegue y sustituir los enlaces a Cal.com de `coach/index.html` por el nuevo calendario. Ajustar también el texto de confirmación: este sistema envía citas por correo, **no crea Google Meet automáticamente**.

Cloudflare y Resend tienen límites gratuitos; no se ha activado ningún plan de pago. Stripe cobra por transacción. Referencias oficiales:

- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://resend.com/pricing
- https://stripe.com/mx/pricing

## Verificación antes de activar

```sh
npm test
npx wrangler@4 d1 execute ubaman-booking --local --file schema.sql
npm run dev
```

Las pruebas usan SQLite real y respuestas simuladas de Stripe/Resend. Verifican límites, transacciones, precios, firma, recuperación e idempotencia. **No sustituyen una prueba completa en Workers con las cuentas conectadas.**

- Pagar una reserva ficticia y recibir ambos correos con todas las fechas correctas.
- Importar el `.ics` en el calendario del coach y del cliente; verificar las zonas horarias.
- Intentar reservar el mismo horario desde dos navegadores y comprobar que solo uno llega a Checkout.
- Completar un paquete de 3 y uno de 5 fechas; comprobar importes USD 96 y USD 160.
- Abandonar Checkout y comprobar la liberación tras su caducidad confirmada en Stripe (35 minutos más la ejecución del reconciliador).
- Reenviar el webhook en el panel Stripe: no debe duplicar la reserva ni los correos.
- Verificar que Turnstile rechaza tokens inválidos y que `/api/admin` no entrega datos sin clave.
- Revisar el consumo de CPU en Workers Free al probar disponibilidad, pago y webhook. Solo se considerará listo tras comprobar los límites en la cuenta real.

## Operación y límites de esta versión

- `/admin.html`: lista reservas y estados de correo, bloquea/desbloquea días. Bloquear un día no cancela reservas existentes. Modificar horas y días generales en las variables del Worker y volver a desplegar.
- El email y el archivo de calendario llegan automáticamente después de verificar el pago. Ubaman agrega las citas a su calendario y envía el enlace de la llamada por correo. **No se consulta Google Calendar para detectar eventos ajenos a este sistema**; bloquear esos días antes de aceptar reservas. Durante la migración, bloquear aquí cualquier reserva previa de Cal.com.
- No hay cancelación, reprogramación ni reembolso automáticos. Se coordinan con Ubaman por correo; devolver dinero desde Stripe no libera ni cancela una sesión en esta base. Hacer estos cambios manuales solo después de comprobar el pago y la reserva.
- Los huecos se retienen hasta que Stripe confirme que Checkout ha caducado. No se liberan por el simple paso del reloj: un webhook retrasado no debe causar una venta doble.
- El cron cada 5 minutos reconcilia pedidos y reintenta correos. Los intentos ambiguos de crear Checkout se recuperan con la misma clave de idempotencia y los mismos datos. Después de 23 horas pasan a revisión sin liberar espacio a ciegas. Los errores se ven en el panel y en D1; el administrador debe revisarlos.
- Resend deduplica durante 24 horas. Los reintentos se detienen antes de ese límite y quedan en `review`. Consultar el registro de Resend antes de reenviar manualmente para evitar duplicados.
- La página de resultado no confirma pagos: consulta el estado guardado por un webhook firmado o por la reconciliación autenticada con Stripe. No se exponen nombres o correos en endpoints públicos. Los enlaces de resultado son privados; no compartirlos.
- Las reservas y correos se almacenan en D1. Revisar periódicamente las reservas antiguas y eliminar los datos personales que ya no se necesiten, conservando los registros contables necesarios en Stripe.

## Detalles para mantenimiento

Los paquetes y la duración están en `src/core.js`. El máximo diario y la comprobación de solapamientos están también en el trigger de `schema.sql`; cambiar esta política exige una migración, no solo un cambio visual. La transacción D1 almacena el pedido completo y todos sus horarios o no almacena ninguno. No hay claves privadas en los recursos estáticos.

Documentación de implementación:

- https://developers.cloudflare.com/d1/worker-api/d1-database/#batch
- https://docs.stripe.com/api/checkout/sessions/create
- https://docs.stripe.com/webhooks/signature
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://resend.com/docs/dashboard/emails/idempotency-keys
