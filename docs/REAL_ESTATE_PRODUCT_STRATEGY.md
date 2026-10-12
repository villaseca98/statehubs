# StateHubs Inmobiliaria — estrategia de producto y piloto

**Estado:** hipótesis de trabajo, pendiente de validar con agencias reales.  
**Objetivo:** convertir el motor configurable actual de StateHubs en un CRM inmobiliario comercializable para agencias con varios agentes, sin reescribir el producto desde cero.

## 1. Decisión de producto

StateHubs no debe venderse inicialmente como «un CRM con IA» ni como un constructor genérico. El motor de planos JSON, módulos, propuestas, versiones y vuelta atrás es tecnología interna. La experiencia comercial debe parecer un producto inmobiliario específico.

**Posicionamiento a validar:**  
*StateHubs ayuda al gerente de una inmobiliaria a detectar operaciones que se están enfriando, saber qué debe hacer cada agente hoy y supervisar el seguimiento comercial sin perseguir al equipo manualmente.*

Promesa principal: **ninguna oportunidad importante debería quedarse sin siguiente paso**. No prometer aumento de ventas hasta medirlo en pilotos.

## 2. Diferenciación a probar

1. **Bandeja de acción para el gerente:** leads sin atender, contactos que llevan demasiado tiempo sin actividad, visitas cuyo resultado no se ha registrado, ofertas sin siguiente paso y operaciones próximas a una fecha crítica.
2. **Seguimiento por agente:** carga de trabajo, tareas vencidas, velocidad de primera respuesta, visitas realizadas, conversión entre fases y operaciones estancadas.
3. **Próxima mejor acción explicable:** cada alerta debe indicar qué ha ocurrido, por qué importa y qué acción concreta recomienda. Empezar con reglas transparentes; IA generativa solo cuando aporte valor demostrable.
4. **Implantación acompañada:** importar datos y configurar etapas junto con las primeras agencias para reducir el coste de cambiar de CRM.

Estas ventajas son hipótesis. Validarlas con 15–20 entrevistas y 3 pilotos de pago antes de ampliar el alcance.

## 3. Qué reutilizamos del motor actual

- Blueprint, entidades, campos, vistas y relaciones configurables.
- Sector inmobiliaria en supabase/functions/_shared/blueprint/sectors.ts.
- Vista «Hoy» (src/lib/crm/today.ts) y listas de trabajo.
- Motor de análisis (supabase/functions/_shared/blueprint/analysis.ts) para embudo, previsión, leads que se enfrían y calidad de datos.
- Versiones, propuestas y vuelta atrás del constructor.
- Modo demo y registros de ejemplo.

La aplicación debe abrir en la experiencia inmobiliaria preconfigurada, no en una elección entre CRM, ERP y constructor. La configuración avanzada se puede conservar en segundo plano o para una fase posterior.

## 4. MVP comercial: solo lo necesario

### Imprescindible para el piloto
- Agencia y usuarios: propietario/gerente y agente, con permisos claros.
- Asignación de cada lead, comprador, propietario, inmueble y operación a una agencia y, cuando proceda, a un agente responsable.
- Bandeja «Hoy»: leads nuevos sin atender, próximo contacto vencido, visita sin resultado, oferta sin seguimiento y operación estancada.
- Ficha de comprador/vendedor y necesidad de búsqueda; ficha de inmueble; visitas; ofertas/operaciones y fases.
- Panel del gerente con métricas definidas y calculadas de forma consistente.
- Importación CSV con previsualización, validación y detección básica de duplicados.
- Auditoría básica de cambios, exportación de datos y copias de seguridad.
- Demo con datos ficticios y flujo de onboarding guiado.

### Fuera del primer MVP
- Publicación/sincronización con todos los portales inmobiliarios.
- Web inmobiliaria completa, firma digital, contratos, facturación y MLS.
- Envíos automáticos masivos por WhatsApp o email.
- IA que tome decisiones comerciales sin revisión humana.
- Constructor genérico de CRM/ERP como propuesta de valor de la landing inicial.

## 5. Bloqueador técnico principal detectado

La migración actual modela crm_apps.owner_id y las políticas RLS mediante crm_owns_app() limitan el acceso al propietario individual. crmApi.createApp(ownerId) también crea aplicaciones a nombre de un usuario. Esto no representa todavía una agencia con varios usuarios que comparten los mismos datos.

**Antes de introducir datos reales de clientes, diseñar y probar el modelo multiusuario/multitenant.** Propuesta a evaluar:
- organizations o agencies;
- organization_members con roles;
- vincular las aplicaciones/datos a una organización;
- políticas RLS que autoricen por pertenencia y rol;
- verificar las funciones SECURITY DEFINER, permisos y acceso entre organizaciones;
- migración sin pérdida de datos y pruebas negativas de aislamiento.

No desplegar cambios de seguridad a producción sin pruebas y revisión de la migración. No asumir que ocultar elementos en la interfaz equivale a seguridad.

## 6. Seguridad y preparación comercial

Antes de un piloto con datos personales:
- comprobar separación de datos entre agencias y entre roles;
- revisar autenticación, políticas RLS y funciones con privilegios;
- comprobar que no hay secretos en el repositorio o en el bundle cliente;
- configurar copias de seguridad y probar restauración;
- preparar exportación, eliminación, retención y documentación de privacidad;
- definir responsabilidades y acuerdos de tratamiento de datos aplicables al servicio.

## 7. Validación comercial

### Entrevistas
Hablar con 15–20 agencias con aproximadamente 3–15 agentes. Investigar:
- CRM actual y coste;
- cómo reciben leads y asignan responsables;
- cómo controlan el primer contacto y los seguimientos;
- qué indicadores mira el gerente;
- qué tareas se hacen fuera del CRM;
- qué les impediría cambiar o añadir una herramienta.

No enseñar la solución antes de escuchar el problema. Registrar palabras literales, frecuencia y consecuencias del problema.

### Pilotos
Conseguir 3 agencias dispuestas a pagar por un piloto limitado y con acompañamiento. Precio de prueba sugerido: **49 €/mes durante el piloto**, a validar; posible tarifa objetivo inicial: **99 €/mes por agencia** si el valor y el alcance lo justifican. Son hipótesis, no precios validados.

Medir antes y después: tiempo hasta el primer contacto, leads sin siguiente acción, seguimientos vencidos, visitas sin resultado, uso semanal por agente y voluntad de continuar pagando.

### Regla de decisión
- Si el problema no se repite en varias entrevistas, revisar el posicionamiento.
- Si lo reconocen pero no pagan, revisar comprador, valor, confianza e implantación.
- Si pagan pero no lo usan, reducir fricción y simplificar el flujo.
- No ampliar funcionalidades hasta que los pilotos aporten evidencia de uso y retención.

## 8. Plan de ejecución

1. Auditar flujos y pruebas existentes; establecer línea base de build, tests y lint en un entorno local/CI.
2. Diseñar el modelo de organización, roles y RLS antes de datos de clientes.
3. Convertir el sector inmobiliario en experiencia inicial dedicada y coherente.
4. Implementar la bandeja de acción y panel de gerente con métricas verificables.
5. Añadir importación CSV segura y onboarding.
6. Ejecutar pilotos y priorizar según evidencia.

## 9. Criterios de aceptación del primer piloto

- Un gerente puede invitar/gestionar agentes con permisos definidos.
- Un agente no puede consultar ni modificar datos de otra agencia.
- Los leads se pueden asignar y muestran responsable y siguiente acción.
- La vista «Hoy» detecta correctamente seguimientos vencidos y visitas pendientes de resultado.
- Las métricas del panel se pueden explicar y contrastar con los registros.
- Importación y exportación funcionan con datos de prueba.
- Build, tests y lint pasan en CI; pruebas RLS negativas incluidas.
- El producto tiene una demo con datos ficticios y no expone claves privadas.

---
Este documento es una estrategia inicial. Las decisiones de producto, precio y diferenciación deben ajustarse tras entrevistar a clientes y revisar el comportamiento real de la aplicación.
