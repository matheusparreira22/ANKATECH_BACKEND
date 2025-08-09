# Guia de Deploy - ANKATECH Backend

Este documento contém instruções detalhadas para fazer deploy da API ANKATECH em diferentes ambientes.

## 📋 Pré-requisitos

### Ambiente Local
- Node.js 18+ 
- PostgreSQL 15+
- npm ou yarn
- Git

### Ambiente de Produção
- Servidor Linux (Ubuntu 20.04+ recomendado)
- Docker e Docker Compose (opcional)
- Nginx (para proxy reverso)
- SSL/TLS certificado
- Domínio configurado

## 🚀 Deploy Local

### 1. Clonar o Repositório
```bash
git clone <repository-url>
cd ANKATECH_BACKEND
```

### 2. Instalar Dependências
```bash
npm install
```

### 3. Configurar Banco de Dados
```bash
# Iniciar PostgreSQL
sudo service postgresql start

# Criar banco de dados
sudo -u postgres createdb plannerdb
sudo -u postgres psql -c "CREATE USER planner WITH PASSWORD 'plannerpw';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE plannerdb TO planner;"
```

### 4. Configurar Variáveis de Ambiente
```bash
cp .env.example .env
```

Editar `.env`:
```env
DATABASE_URL="postgresql://planner:plannerpw@localhost:5432/plannerdb"
JWT_SECRET="your-super-secret-jwt-key-here"
NODE_ENV="development"
PORT=3000
```

### 5. Executar Migrações
```bash
npx prisma migrate deploy
npx prisma generate
```

### 6. Iniciar Servidor
```bash
# Desenvolvimento
npm run dev

# Produção
npm run build
npm start
```

## 🐳 Deploy com Docker

### 1. Criar docker-compose.yml
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: plannerdb
      POSTGRES_USER: planner
      POSTGRES_PASSWORD: plannerpw
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: "postgresql://planner:plannerpw@postgres:5432/plannerdb"
      JWT_SECRET: "your-super-secret-jwt-key-here"
      NODE_ENV: "production"
    depends_on:
      - postgres
    volumes:
      - ./uploads:/app/uploads

volumes:
  postgres_data:
```

### 2. Criar Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

### 3. Executar
```bash
docker-compose up -d
```

## ☁️ Deploy em Produção (VPS/Cloud)

### 1. Preparar Servidor
```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Instalar PM2 (gerenciador de processos)
sudo npm install -g pm2
```

### 2. Configurar PostgreSQL
```bash
sudo -u postgres psql
CREATE DATABASE plannerdb;
CREATE USER planner WITH PASSWORD 'strong-password-here';
GRANT ALL PRIVILEGES ON DATABASE plannerdb TO planner;
\q
```

### 3. Configurar Aplicação
```bash
# Clonar repositório
git clone <repository-url> /var/www/ankatech-api
cd /var/www/ankatech-api

# Instalar dependências
npm ci --only=production

# Configurar variáveis de ambiente
sudo nano .env
```

Configurar `.env` para produção:
```env
DATABASE_URL="postgresql://planner:strong-password-here@localhost:5432/plannerdb"
JWT_SECRET="super-strong-jwt-secret-key-for-production"
NODE_ENV="production"
PORT=3000
```

### 4. Executar Migrações
```bash
npx prisma migrate deploy
npx prisma generate
```

### 5. Configurar PM2
```bash
# Criar arquivo ecosystem
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'ankatech-api',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
EOF

# Criar diretório de logs
mkdir logs

# Iniciar aplicação
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 6. Configurar Nginx
```bash
sudo apt install nginx -y

# Criar configuração
sudo nano /etc/nginx/sites-available/ankatech-api
```

Configuração do Nginx:
```nginx
server {
    listen 80;
    server_name api.ankatech.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Ativar site
sudo ln -s /etc/nginx/sites-available/ankatech-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7. Configurar SSL com Let's Encrypt
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d api.ankatech.com
```

## 🔧 Configurações Avançadas

### Backup Automático do Banco
```bash
# Criar script de backup
cat > /home/ubuntu/backup-db.sh << EOF
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h localhost -U planner plannerdb > /home/ubuntu/backups/plannerdb_$DATE.sql
find /home/ubuntu/backups -name "*.sql" -mtime +7 -delete
EOF

chmod +x /home/ubuntu/backup-db.sh

# Adicionar ao crontab (backup diário às 2h)
echo "0 2 * * * /home/ubuntu/backup-db.sh" | crontab -
```

### Monitoramento com PM2
```bash
# Instalar PM2 monitoring
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30

# Monitorar aplicação
pm2 monit
```

### Rate Limiting Avançado
No arquivo de produção, ajustar:
```javascript
// src/index.ts
await fastify.register(rateLimit.default, {
  max: process.env.NODE_ENV === 'production' ? 1000 : 100,
  timeWindow: '1 minute',
  redis: process.env.REDIS_URL // Se usando Redis
})
```

## 📊 Monitoramento e Logs

### Logs da Aplicação
```bash
# Ver logs em tempo real
pm2 logs ankatech-api

# Ver logs específicos
pm2 logs ankatech-api --lines 100
```

### Logs do Nginx
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Métricas do Sistema
```bash
# Status da aplicação
pm2 status

# Uso de recursos
pm2 monit

# Reiniciar aplicação
pm2 restart ankatech-api

# Recarregar configuração
pm2 reload ankatech-api
```

## 🔒 Segurança

### Firewall
```bash
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### Atualizações Automáticas
```bash
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure -plow unattended-upgrades
```

### Backup de Segurança
```bash
# Backup completo da aplicação
tar -czf ankatech-backup-$(date +%Y%m%d).tar.gz /var/www/ankatech-api
```

## 🚨 Troubleshooting

### Problemas Comuns

1. **Erro de conexão com banco**
   ```bash
   # Verificar status do PostgreSQL
   sudo systemctl status postgresql
   
   # Testar conexão
   psql -h localhost -U planner -d plannerdb
   ```

2. **Aplicação não inicia**
   ```bash
   # Verificar logs
   pm2 logs ankatech-api
   
   # Verificar variáveis de ambiente
   pm2 env 0
   ```

3. **Erro 502 Bad Gateway**
   ```bash
   # Verificar se aplicação está rodando
   pm2 status
   
   # Verificar configuração do Nginx
   sudo nginx -t
   ```

### Comandos Úteis
```bash
# Reiniciar todos os serviços
sudo systemctl restart postgresql
pm2 restart all
sudo systemctl restart nginx

# Verificar portas em uso
sudo netstat -tlnp | grep :3000

# Verificar espaço em disco
df -h

# Verificar uso de memória
free -h
```

## 📞 Suporte

Para problemas de deploy, verificar:
1. Logs da aplicação (`pm2 logs`)
2. Logs do sistema (`journalctl -f`)
3. Status dos serviços (`systemctl status`)
4. Conectividade de rede (`curl localhost:3000/health`)

---

**Versão**: 0.5.0  
**Última atualização**: Janeiro 2024
