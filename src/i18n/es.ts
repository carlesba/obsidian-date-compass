import type { Translation } from "./en.ts";

export const es: Translation = {
	languageEnglish: "Inglés",
	languageSpanish: "Español",

	parserLanguages: "Idiomas",
	parserLanguagesDesc: "Las expresiones de fecha se entienden en cada idioma activado aquí.",
	weekStart: "La semana empieza el",
	weekStartDesc: "El primer día de la semana, para las notas semanales y expresiones como \"este miércoles\".",
	weekStartLocale: "Según la configuración regional",
	weekStartMonday: "Lunes",
	weekStartSunday: "Domingo",
	nextWeekday: "\"Próximo\" día de la semana significa",
	nextWeekdayDesc: "A qué apunta una expresión como \"el próximo miércoles\".",
	nextWeekdayNextWeek: "Ese día de la semana que viene",
	nextWeekdayNextOccurrence: "La próxima vez que llegue ese día",
	dayMonthOrder: "Fechas numéricas",
	dayMonthOrderDesc: "Cómo se lee una fecha como 3/12.",
	dayMonthOrderDayMonth: "Día y luego mes",
	dayMonthOrderMonthDay: "Mes y luego día",

	dateNotesSection: "Notas de fecha",
	dateNotesSectionDesc: "Carpetas, formatos de nombre y plantillas de las notas diarias, semanales, mensuales, trimestrales y anuales.",
	mentionsSection: "Menciones",
	mentionsSectionDesc: "Enlaza una nota de fecha mientras escribes, tras un activador como @.",
	insertSequenceSection: "Insertar secuencia",
	insertSequenceSectionDesc: "Inserta en el cursor los enlaces de un rango o una secuencia de fechas.",
	actionsSection: "Acciones",
	actionsSectionDesc: "Comandos que piden fechas y las escriben en propiedades o en la nota.",

	resetAllSettings: "Restablecer todos los ajustes",
	resetAllSettingsDesc: "Devuelve cada opción a los valores predeterminados.",
	resetTitle: "¿Restablecer todos los ajustes de Date Compass?",
	resetMessage: "Cada opción vuelve a los valores predeterminados. No se puede deshacer.",
	cancel: "Cancelar",
	reset: "Restablecer",
};
