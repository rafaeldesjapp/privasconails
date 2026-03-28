'use client';

import React from 'react';
import { Briefcase, ExternalLink, Image as ImageIcon, FileText } from 'lucide-react';

const PortfolioPage = () => {
  const projects = [
    {
      id: 1,
      title: "Expansão Logística Global",
      client: "Global Logistics",
      category: "Consultoria Estratégica",
      image: "https://picsum.photos/seed/project1/800/600",
      description: "Otimização da malha de distribuição reduzindo custos operacionais em 15%."
    },
    {
      id: 2,
      title: "Transformação Digital ERP",
      client: "TechFlow Solutions",
      category: "Implementação de Sistemas",
      image: "https://picsum.photos/seed/project2/800/600",
      description: "Migração completa de infraestrutura legada para nuvem com foco em escalabilidade."
    },
    {
      id: 3,
      title: "Gestão de Ativos Imobiliários",
      client: "Inova Tech",
      category: "Gestão de Ativos",
      image: "https://picsum.photos/seed/project3/800/600",
      description: "Reestruturação do portfólio de ativos com foco em maximização de dividendos."
    }
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-black font-headline text-slate-900 tracking-tight">Meu Portfólio</h2>
        <p className="text-sm text-slate-500 font-medium">Histórico de projetos e cases de sucesso</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <div key={project.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-md transition-all group">
            <div className="relative h-48 overflow-hidden">
              <img 
                src={project.image} 
                alt={project.title} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute top-4 left-4">
                <span className="px-3 py-1 bg-white/90 backdrop-blur-sm text-blue-700 text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm">
                  {project.category}
                </span>
              </div>
            </div>
            <div className="p-6">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">{project.client}</p>
              <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-blue-700 transition-colors">{project.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">{project.description}</p>
              
              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <button className="flex items-center gap-2 text-xs font-bold text-blue-700 hover:underline">
                  <FileText className="w-4 h-4" />
                  Ver Case
                </button>
                <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-700 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <h3 className="text-2xl font-black font-headline mb-4">Pronto para o próximo desafio?</h3>
          <p className="text-blue-100 mb-6 font-medium">Adicione novos cases ao seu portfólio e compartilhe com seus leads para aumentar sua taxa de conversão.</p>
          <button className="px-6 py-3 bg-white text-blue-700 font-black rounded-xl shadow-lg hover:scale-105 transition-all flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            Adicionar Novo Projeto
          </button>
        </div>
        <div className="absolute -right-20 -bottom-20 opacity-10">
          <Briefcase className="w-80 h-80" />
        </div>
      </div>
    </div>
  );
};

export default PortfolioPage;
