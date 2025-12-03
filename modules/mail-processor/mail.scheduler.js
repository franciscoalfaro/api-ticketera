import cron from "node-cron";
import { processIncomingEmails } from "./mail.service.js";
import { processUnreadEmails } from "./mail.listener.js";


cron.schedule('* * * * *', async () => {
    try {
        console.log('Ejecutando análisis de correos entrantes...');
        await processUnreadEmails();
        console.log('Tarea programada completada');
    } catch (error) {  // Fixed: use 'error' consistently
        console.error("Error procesando correos:", error);  // Fixed variable name
    }
}, {
    timezone: 'America/Santiago'  // Valid for Chile (CLT/CLST) [web:32]
});
console.log('Scheduler de correo iniciado y programado para ejecutarse cada minuto.');

