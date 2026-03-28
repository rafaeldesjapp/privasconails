import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4 text-center">
      <h2 className="text-4xl font-black text-blue-800 mb-4 font-headline tracking-tight">404</h2>
      <p className="text-slate-600 mb-8 font-medium">Ops! A página que você procura não existe.</p>
      <Link 
        href="/"
        className="px-6 py-3 bg-gradient-to-br from-[#003d9b] to-[#0052cc] text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 hover:scale-[1.02] transition-all"
      >
        Voltar ao Dashboard
      </Link>
    </div>
  );
}
