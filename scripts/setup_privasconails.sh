#!/bin/bash
# ============================================
# 🚀 SETUP RÁPIDO - PRIVASCA NAILS
# ============================================
# Execute com: bash /app/scripts/setup_privasconails.sh
# ============================================

echo "🔄 Iniciando setup do Privasca Nails..."

# Verificar se o projeto já está na pasta frontend
if [ -f "/app/frontend/package.json" ]; then
    # Verificar se é o projeto correto (Next.js)
    if grep -q "next" /app/frontend/package.json; then
        echo "✅ Projeto Privasca Nails já está configurado!"
        
        # Verificar se node_modules existe
        if [ ! -d "/app/frontend/node_modules" ]; then
            echo "📦 Instalando dependências..."
            cd /app/frontend && npm install --silent
        fi
        
        # Verificar se .env.local existe
        if [ ! -f "/app/frontend/.env.local" ]; then
            echo "⚙️ Criando arquivo de ambiente..."
            cat > /app/frontend/.env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://fxoysrviojbyygelgjln.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4b3lzcnZpb2pieXlnZWxnamxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MTg3ODAsImV4cCI6MjA5MDE5NDc4MH0.IjB6QP943gJ2B3d9fB9lSpiUgftZU8q5m1IIQ2dBbMc
EOF
        fi
        
        # Verificar se o servidor já está rodando
        if pgrep -f "next dev" > /dev/null; then
            echo "✅ Servidor Next.js já está rodando!"
        else
            echo "🚀 Iniciando servidor Next.js..."
            cd /app/frontend && npm run dev > /var/log/supervisor/frontend.out.log 2>&1 &
            sleep 5
        fi
        
        echo ""
        echo "============================================"
        echo "✅ PRIVASCA NAILS PRONTO!"
        echo "============================================"
        echo "🌐 URL: https://repo-editor-8.preview.emergentagent.com"
        echo ""
        echo "📧 Login de teste:"
        echo "   Email: cliente@gmail.com"
        echo "   Senha: 123456"
        echo "============================================"
        exit 0
    fi
fi

# Se chegou aqui, precisa clonar o repositório
echo "📥 Clonando repositório do GitHub..."
cd /app
rm -rf temp_repo 2>/dev/null

git clone https://github.com/rafaeldesjapp/privasconails.git temp_repo

if [ $? -eq 0 ]; then
    echo "✅ Repositório clonado!"
    
    # Backup do frontend atual se existir
    if [ -d "/app/frontend" ]; then
        rm -rf /app/frontend_backup 2>/dev/null
        mv /app/frontend /app/frontend_backup
    fi
    
    # Mover para frontend
    mv temp_repo frontend
    
    # Criar .env.local
    cat > /app/frontend/.env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://fxoysrviojbyygelgjln.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4b3lzcnZpb2pieXlnZWxnamxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MTg3ODAsImV4cCI6MjA5MDE5NDc4MH0.IjB6QP943gJ2B3d9fB9lSpiUgftZU8q5m1IIQ2dBbMc
EOF
    
    # Instalar dependências
    echo "📦 Instalando dependências..."
    cd /app/frontend && npm install --silent
    
    # Parar frontend atual se estiver rodando
    sudo supervisorctl stop frontend 2>/dev/null
    pkill -f "next dev" 2>/dev/null
    
    # Iniciar servidor
    echo "🚀 Iniciando servidor..."
    cd /app/frontend && npm run dev > /var/log/supervisor/frontend.out.log 2>&1 &
    sleep 5
    
    echo ""
    echo "============================================"
    echo "✅ PRIVASCA NAILS CONFIGURADO E RODANDO!"
    echo "============================================"
    echo "🌐 URL: https://repo-editor-8.preview.emergentagent.com"
    echo ""
    echo "📧 Login de teste:"
    echo "   Email: cliente@gmail.com"
    echo "   Senha: 123456"
    echo "============================================"
else
    echo "❌ Erro ao clonar repositório!"
    exit 1
fi
