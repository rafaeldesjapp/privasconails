'use client';

import React from 'react';
import { Tag, Check, HelpCircle, TrendingUp, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

const PricingTablePage = () => {
  const plans = [
    {
      name: "Standard",
      price: "R$ 2.400",
      period: "/mês",
      description: "Ideal para pequenas empresas e consultorias individuais.",
      features: [
        "Até 50 contatos ativos",
        "Pipeline de vendas básico",
        "Suporte via e-mail",
        "Exportação de dados (CSV)",
        "Relatórios mensais"
      ],
      color: "blue",
      popular: false
    },
    {
      name: "Enterprise",
      price: "R$ 5.800",
      period: "/mês",
      description: "Nossa solução completa para times de alta performance.",
      features: [
        "Contatos ilimitados",
        "Múltiplos pipelines",
        "Suporte 24/7 prioritário",
        "Integração via API",
        "Insights de IA avançados",
        "Gestão de permissões"
      ],
      color: "blue-dark",
      popular: true
    },
    {
      name: "Custom",
      price: "Sob Consulta",
      period: "",
      description: "Soluções personalizadas para grandes corporações.",
      features: [
        "Infraestrutura dedicada",
        "SLA garantido",
        "Consultoria de implantação",
        "White-label opcional",
        "Treinamento presencial"
      ],
      color: "slate",
      popular: false
    }
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-black font-headline text-slate-900 tracking-tight">Tabela de Preços</h2>
          <p className="text-sm text-slate-500 font-medium">Planos e serviços disponíveis para seus clientes</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white text-slate-700 font-bold rounded-xl shadow-sm border border-slate-200 text-xs flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Simular ROI
          </button>
          <button className="px-4 py-2 bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 text-xs flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Gerar Orçamento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((plan) => (
          <div 
            key={plan.name} 
            className={cn(
              "bg-white rounded-3xl p-8 shadow-sm border transition-all duration-300 flex flex-col relative",
              plan.popular ? "border-blue-500 shadow-xl shadow-blue-900/5 scale-105 z-10" : "border-slate-100 hover:shadow-md"
            )}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full shadow-lg">
                Mais Popular
              </div>
            )}
            
            <div className="mb-8">
              <h3 className="text-xl font-black font-headline text-slate-900 mb-2">{plan.name}</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">{plan.description}</p>
            </div>

            <div className="mb-8">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black font-headline text-slate-900">{plan.price}</span>
                <span className="text-sm text-slate-400 font-bold">{plan.period}</span>
              </div>
            </div>

            <div className="flex-1 space-y-4 mb-8">
              {plan.features.map((feature) => (
                <div key={feature} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-emerald-600" />
                  </div>
                  <span className="text-sm text-slate-600 font-medium">{feature}</span>
                </div>
              ))}
            </div>

            <button className={cn(
              "w-full py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2",
              plan.popular 
                ? "bg-blue-700 text-white shadow-lg shadow-blue-900/20 hover:scale-[1.02]" 
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            )}>
              Selecionar Plano
            </button>
          </div>
        ))}
      </div>

      <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-blue-700">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-slate-900">Dúvidas sobre os planos?</h4>
            <p className="text-sm text-slate-500 font-medium">Nossa equipe comercial está pronta para ajudar você a escolher a melhor opção.</p>
          </div>
        </div>
        <button className="px-6 py-3 bg-white text-slate-700 font-black rounded-xl shadow-sm border border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-2">
          Falar com Especialista
        </button>
      </div>
    </div>
  );
};

export default PricingTablePage;
