# Plano de Ação - Backend

## Visão Geral
O backend será desenvolvido com Node.js 20, Fastify 4, TypeScript, Prisma ORM (PostgreSQL 15), Zod v4, JWT para autenticação, Jest/Supertest para testes (80% de cobertura), e ESLint para formatação. O objetivo é implementar APIs CRUD, motor de projeção patrimonial, sugestões automáticas, SSE para importação de CSV, histórico de simulações e perfis de seguro, com documentação via @fastify/swagger e implantação via Docker Compose.

## Cronograma e Marcos

### Dia 1: Planejamento e Configuração
- **Objetivo**: Configurar o repositório e definir a arquitetura do backend.
- **Tarefas**:
  - Criar repositório `backend/` com Node.js, Fastify, TypeScript, ESLint e Jest.
  - Configurar Docker Compose com serviço PostgreSQL 15 (conforme especificado: `POSTGRES_USER: planner`, `POSTGRES_PASSWORD: plannerpw`, `POSTGRES_DB: plannerdb`).
  - Definir esquema do banco para `clients` (nome, email, idade, status, perfil_familiar), `goals` (tipo, valor_alvo, data_alvo), `wallet` (client_id, classes_ativos, percentuais, valor_total), `events` (tipo, valor, frequência, client_id) e `simulations` (client_id, dados_projeção, created_at).
  - Esboçar endpoints da API (CRUD, projeções, SSE).
  - Criar `README.md` com instruções iniciais de configuração e suposições (ex.: moeda BRL, taxa padrão 4% a.a.).
- **Entregáveis**:
  - Estrutura do repositório `backend/`.
  - Arquivo `docker-compose.yml` com serviço de banco.
  - Esquema inicial do banco e lista de endpoints no `README.md`.
- **Tempo Estimado**: 4-5 horas.

### Dia 2: Banco de Dados e APIs CRUD
- **Objetivo**: Configurar o banco e implementar APIs CRUD principais.
- **Tarefas**:
  - Configurar Prisma ORM e criar migrações para as tabelas definidas.
  - Implementar autenticação JWT com roles `advisor` (escrita/leitura) e `viewer` (somente leitura).
  - Desenvolver endpoints CRUD para:
    - `clients`: criar, listar, atualizar, deletar.
    - `goals`: registrar metas com valor e data-alvo.
    - `wallet`: registrar carteira (classes, percentuais, valor total) e calcular alinhamento (patrimônio no plano ÷ patrimônio atual).
    - `events`: registrar movimentações (tipo, valor, frequência).
  - Integrar Zod v4 para validação de dados nos endpoints.
  - Configurar `@fastify/swagger` para documentação inicial.
  - Escrever testes unitários para autenticação e CRUD com Jest.
- **Entregáveis**:
  - Esquema Prisma e migrações.
  - Middleware JWT com roles.
  - Endpoints CRUD com validação Zod.
  - Documentação inicial do Swagger.
  - Testes unitários (cobertura ≥80%).
- **Tempo Estimado**: 8-10 horas.

### Dia 3: Motor de Projeção e Sugestões
- **Objetivo**: Implementar o motor de projeção patrimonial e serviço de sugestões.
- **Tarefas**:
  - Criar função `simulateWealthCurve(initialState, events, rate)`:
    - Calcular crescimento composto mensal com a fórmula: `valor = inicial * (1 + taxa/12)^(meses)`.
    - Ajustar para eventos únicos/recorrentes (positivos/negativos).
    - Retornar array de `{year, projectedValue}` até 2060.
  - Implementar endpoint para projeção com taxa padrão (4% a.a.).
  - Desenvolver serviço de sugestões:
    - Analisar diferença de alinhamento (`valor_planejado - valor_atual`).
    - Gerar sugestões (ex.: "Aumente a contribuição em R$410 por 24 meses").
  - Escrever testes unitários e de integração para projeção e sugestões.
- **Entregáveis**:
  - Função e endpoint de projeção patrimonial.
  - Serviço e endpoint de sugestões.
  - Testes para projeção e sugestões (cobertura ≥80%).
- **Tempo Estimado**: 8-10 horas.

### Dia 4: SSE, Simulações e Seguros
- **Objetivo**: Implementar SSE para importação de CSV, histórico de simulações e perfis de seguro.
- **Tarefas**:
  - Criar endpoint SSE para importação de CSV (ex.: clientes):
    - Processar CSV em blocos, validar com Zod, atualizar banco.
    - Enviar progresso (ex.: "Processado 50/100 linhas") via SSE.
  - Implementar histórico de simulações:
    - Salvar projeções com metadados (client_id, timestamp).
    - Criar endpoints para listar e recuperar simulações.
  - Desenvolver CRUD para perfis de seguro (vida/invalidez, detalhes).
  - Escrever testes de integração e E2E para SSE, simulações e seguros.
  - Finalizar documentação do Swagger.
- **Entregáveis**:
  - Endpoint SSE para CSV com progresso.
  - Endpoints de histórico de simulações.
  - Endpoints CRUD de seguros.
  - Testes para SSE, simulações e seguros (cobertura ≥80%).
  - Documentação completa do Swagger.
- **Tempo Estimado**: 8-10 horas.

### Dia 5: Testes e Refinamento
- **Objetivo**: Garantir qualidade do código e cobertura de testes.
- **Tarefas**:
  - Executar suíte de testes (unitários, integração, E2E) com Jest/Supertest.
  - Corrigir falhas e otimizar performance.
  - Verificar cobertura de testes (mínimo 80%) com `jest --coverage`.
  - Revisar código com ESLint para conformidade.
- **Entregáveis**:
  - Suíte de testes completa com cobertura ≥80%.
  - Código otimizado e conforme ESLint.
- **Tempo Estimado**: 4-6 horas.

### Dia 6: Documentação
- **Objetivo**: Finalizar documentação do backend.
- **Tarefas**:
  - Atualizar `README.md` com:
    - Arquitetura (ex.: estrutura de pastas, fluxos).
    - Lista de endpoints com descrição.
    - Instruções de configuração (`docker compose up`).
    - Suposições (ex.: formato CSV, moeda).
  - Revisar documentação do Swagger para clareza.
- **Entregáveis**:
  - `README.md` completo.
  - Documentação Swagger finalizada.
- **Tempo Estimado**: 3-4 horas.

### Dia 7: Implantação e Validação
- **Objetivo**: Testar e preparar o backend para entrega.
- **Tarefas**:
  - Testar Docker Compose localmente (`docker compose up`).
  - Validar integração com banco e endpoints.
  - Garantir commits limpos e organizados.
  - Empacotar repositório para entrega.
- **Entregáveis**:
  - Backend funcional com Docker.
  - Repositório pronto para entrega.
- **Tempo Estimado**: 3-4 horas.

## Considerações
- **Testes**: Priorizar testes para o motor de projeção (lógica central).
- **Commits**: Fazer commits pequenos e descritivos (ex.: "Adiciona endpoint de projeção").
- **Suposições**: Documentar no `README.md` (ex.: formato CSV, taxa padrão).
- **Docker**: Garantir compatibilidade com o serviço PostgreSQL especificado.