# Microsoft DP-700 Simulator

Simulador web ligero para practicar preguntas del examen **Microsoft DP-700**.

No requiere backend ni proceso de build: todo corre en el navegador con archivos estaticos (`HTML + CSS + JavaScript + JSON`).

## Caracteristicas

- Flujo de examen con pantalla de inicio, navegacion por preguntas y resultados finales.
- Soporte para preguntas de seleccion unica y multiple.
- Boton para revelar/ocultar respuesta correcta por pregunta.
- Persistencia local del progreso con `localStorage`.
- Compatible con despliegue en Cloudflare Pages.

## Estructura del proyecto

```text
.
├── index.html
├── assets/
│   ├── app.js
│   └── styles.css
├── questions/
│   └── <topic>-<number>.json
├── robots.txt
└── wrangler.toml
```

## Formato de preguntas

Cada pregunta se guarda como JSON en `questions/<topic>-<number>.json`.

Ejemplo:

```json
{
  "url": "https://www.examtopics.com/...",
  "published_iso": "2024-12-08T16:47:00",
  "number": 10,
  "topic": 1,
  "question": "...",
  "options": [
    { "key": "A", "text": "..." },
    { "key": "B", "text": "..." }
  ],
  "answers": {
    "platform": ["A"],
    "community": ["A"]
  }
}
```

Reglas importantes:

- `options[].key` debe ser unico por pregunta.
- Las respuestas deben referenciar claves existentes de `options[].key`.
- Si `answers.platform` no esta disponible, la app usa `answers.community` como respaldo.

## Ejecutar en local

Como es un sitio estatico, puedes servirlo con cualquier servidor HTTP.

### Opcion 1: Python

```bash
python3 -m http.server 8080
```

Luego abre: `http://localhost:8080`

### Opcion 2: Node

```bash
npx serve .
```

## Despliegue en Cloudflare Pages (Wrangler)

Prerequisitos:

- Node.js 18+
- `wrangler` (via `npx` o instalado global)
- API Token de Cloudflare con permisos para Pages/Workers

1. Exporta tu token:

```bash
export CLOUDFLARE_API_TOKEN="<TU_TOKEN>"
```

2. (Opcional) Define el Account ID:

```bash
export CLOUDFLARE_ACCOUNT_ID="<TU_ACCOUNT_ID>"
```

3. Crea el proyecto (solo la primera vez):

```bash
npx wrangler pages project create microsoft-dp-700-simulator --production-branch main
```

4. Despliega:

```bash
npx wrangler pages deploy . --project-name microsoft-dp-700-simulator --commit-dirty=true
```

## Notas

- Este repo puede contener preguntas con contenido de imagen/hotspot que requieren curacion adicional del dataset.
- Nunca subas tokens o secretos al repositorio (`.env`, claves API, etc.).
