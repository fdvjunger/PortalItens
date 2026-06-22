# Itens Portal

Aplicação web para visualizar, filtrar, pesquisar, importar e exportar Excel da tabela `spec_items` em PostgreSQL.

## Stack

**Backend:** Python 3.12, FastAPI, SQLAlchemy, psycopg, pydantic-settings, openpyxl, uvicorn

**Frontend:** React, Vite, TypeScript, Material UI, Axios, React Router DOM

## Estrutura

```text
itens-portal/
  backend/       API FastAPI
  frontend/      App React
  database/      Scripts SQL
```

## Pré-requisitos

- Python 3.12
- Node.js 18+
- PostgreSQL com banco `itens_portal` criado no pgAdmin

## Banco de dados

Execute os scripts SQL no banco `itens_portal`:

```text
database/001_create_spec_items.sql
database/002_create_import_audit.sql
```

Ou use o script auxiliar (cria o banco se necessário):

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
$env:PYTHONPATH='.'
python scripts/init_db.py
```

O script executa também `database/003_extend_import_staging.sql` para tabelas de staging da importação.

A coluna `cliente` existe, aceita `NULL` e **não** possui valor default.

## Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

API disponível em `http://127.0.0.1:8000`.

### Variáveis de ambiente (backend)

```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/itens_portal
APP_ENV=local
CORS_ORIGINS=http://localhost:5173
LOG_LEVEL=INFO
```

## Frontend

```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```

App disponível em `http://localhost:5173`.

### Variáveis de ambiente (frontend)

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

## Endpoints principais

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/health` | Health check com teste de conexão PostgreSQL |
| GET | `/api/spec-items/columns` | Metadata das colunas |
| GET | `/api/spec-items` | Listagem paginada com filtros |
| GET | `/api/spec-items/{id}` | Detalhe do item |
| GET | `/api/spec-items/stats` | Estatísticas do dashboard |
| POST | `/api/spec-items/export-excel` | Exportar Excel com filtros |
| GET | `/api/spec-items/export-template` | Template Excel |
| POST | `/api/spec-items/import-excel/analyze` | Analisar arquivo (sem alterar banco) |
| GET | `/api/spec-items/import-excel/runs/{id}` | Detalhe do run com mapeamentos |
| POST | `/api/spec-items/import-excel/runs/{id}/mapping` | Salvar mapeamento e gerar preview |
| GET | `/api/spec-items/import-excel/runs/{id}/preview` | Preview da importação |
| POST | `/api/spec-items/import-excel/runs/{id}/apply` | Aplicar importação no banco |
| POST | `/api/spec-items/import-excel/runs/{id}/cancel` | Cancelar importação |
| GET | `/api/import-runs` | Histórico de importações |
| GET | `/api/import-runs/{id}` | Detalhe da importação com erros |

## Funcionalidades

- Tabela `spec_items` com paginação, ordenação e filtros
- Pesquisa global em múltiplas colunas (ILIKE)
- Exportação Excel com aba `spec_items`, cabeçalho congelado e autofiltro
- Template Excel com aba `metadata`
- Importação Excel com fluxo seguro: **Upload → Análise → Mapeamento → Preview → Apply**
- Staging em `app_import_rows`, mapeamentos em `app_import_column_mappings`, diffs em `app_import_diffs`
- Sugestão automática de sinônimos (`DIAMETRO EXTERNO MM` → `dm_ex`, etc.)
- Logs estruturados no backend e interceptors no Axios (console do navegador)
- Nenhuma alteração em `spec_items` antes do botão **Aplicar no banco**
- Dashboard com totais por cliente, PIPE, FLANGE e alterDataID

## Deploy no Render (futuro)

O projeto usa variáveis de ambiente para conexão com PostgreSQL e CORS, preparado para publicação no Render sem alterações de código.

## Critérios de aceite

1. Backend em `http://127.0.0.1:8000`
2. Frontend em `http://localhost:5173`
3. `/api/health` retorna banco conectado
4. `/api/spec-items/columns` lista colunas
5. `/api/spec-items` lista registros paginados
6. Frontend mostra tabela `spec_items`
7. Filtros e pesquisa global funcionam
8. Exportação e template Excel funcionam
9. Importação faz insert/update com auditoria
10. Coluna `cliente` sem default
11. PostgreSQL via variável `DATABASE_URL`
