import React, { useState, useEffect } from 'react';
import { X, QrCode, CreditCard, CheckCircle2, Copy, ShieldCheck, Lock, Smartphone, Check, Loader2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceName: string;
  amount: number;
  appointmentId: string;
  onPaymentSuccess?: (method: string) => void;
}

export default function PaymentModal({ isOpen, onClose, serviceName, amount, appointmentId, onPaymentSuccess }: PaymentModalProps) {
  const [method, setMethod] = useState<'pix' | 'card' | 'gpay'>('pix');
  const [copied, setCopied] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  // Card Form
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // Lock scroll
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const fmtValue = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Mock Copy Pix Payload
  const handleCopyPix = () => {
    navigator.clipboard.writeText("00020126580014br.gov.bcb.pix0136mock-chave-pix-generica-a1b2c3d4e5f6g7h85204000053039865802BR5909ESTUDIO6009SAO PAULO62070503***6304XXXX");
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSimulatePayment = async (chosenMethod: string) => {
    if (processing) return;
    setProcessing(true);
    
    // Simula a API do Mercado Pago
    setTimeout(async () => {
      try {
        // Como mockup estruturado: atualiza o agendamento real para refletir o pgto
        const { error } = await supabase.from('agendamentos').update({
           payment_method: `Online (${chosenMethod})`
        }).eq('id', appointmentId);

        if (error) {
           if (error.code !== 'PGRST116') console.warn(error);
        }

        if (onPaymentSuccess) onPaymentSuccess(chosenMethod);
        alert(`🎉 PAGAMENTO CONCLUIDO! (${chosenMethod}).\n\nEssa tela é visual e 100% funcional no app. Para débitos bancários reais precisaremos inserir as credenciais do Mercado Pago.`);
        onClose();
      } catch (err) {
        console.error("Erro no pagamento:", err);
      } finally {
        setProcessing(false);
      }
    }, 2000);
  };

  const formatCardNumber = (val: string) => val.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().substring(0, 19);
  const formatExpiry = (val: string) => {
    let clean = val.replace(/\D/g, '').substring(0, 4);
    if (clean.length >= 3) return `${clean.substring(0, 2)}/${clean.substring(2, 4)}`;
    return clean;
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end md:justify-center items-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm transition-all duration-300">
      
      {/* Container Principal */}
      <div className="bg-white w-full max-w-md h-[95vh] md:h-auto md:max-h-[90vh] rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col relative overflow-hidden transform transition-transform animate-slide-up md:animate-in md:zoom-in-95">
        
        {/* Header Expresso */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2 text-slate-700">
            <Lock className="w-4 h-4 text-emerald-500" />
            <span className="font-bold text-sm tracking-tight text-slate-800">Checkout Seguro Mercado Pago</span>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors bg-white shadow-sm border border-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumo Dinâmico (Sempre visível no topo) */}
        <div className="px-6 py-6 border-b border-slate-100 bg-white shrink-0 shadow-[0_10px_20px_rgba(0,0,0,0.02)] relative z-10">
          <p className="text-sm font-medium text-slate-500 mb-1">Você está pagando por:</p>
          <div className="flex justify-between items-end">
            <h2 className="text-xl font-black text-slate-800 line-clamp-1 flex-1 pr-4">{serviceName}</h2>
            <div className="text-2xl font-black text-blue-600 tabular-nums">{fmtValue(amount)}</div>
          </div>
        </div>

        {/* Conteúdo Dinâmico (Tabs) */}
        <div className="flex-1 overflow-y-auto bg-slate-50 relative pb-10">
          
          <div className="p-5 sm:p-6 space-y-4">
            
            {/* Seletor de Métodos */}
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-200/60 rounded-[14px] mb-6 shadow-inner ring-1 ring-black/5">
              <button 
                onClick={() => setMethod('pix')}
                className={cn("flex flex-col items-center gap-1.5 py-3 rounded-[10px] text-xs font-bold transition-all", method === 'pix' ? "bg-white text-blue-600 shadow-sm ring-1 ring-black/5" : "text-slate-500 hover:text-slate-700")}
              >
                <QrCode className="w-5 h-5" /> PIX
              </button>
              <button 
                onClick={() => setMethod('card')}
                className={cn("flex flex-col items-center gap-1.5 py-3 rounded-[10px] text-xs font-bold transition-all", method === 'card' ? "bg-white text-indigo-600 shadow-sm ring-1 ring-black/5" : "text-slate-500 hover:text-slate-700")}
              >
                <CreditCard className="w-5 h-5" /> Cartão
              </button>
              <button 
                onClick={() => setMethod('gpay')}
                className={cn("flex flex-col items-center gap-1.5 py-3 rounded-[10px] text-xs font-bold transition-all", method === 'gpay' ? "bg-white text-slate-800 shadow-sm ring-1 ring-black/5" : "text-slate-500 hover:text-slate-700")}
              >
                <Smartphone className="w-5 h-5" /> Google Pay
              </button>
            </div>

            {/* ABA PIX */}
            {method === 'pix' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                     <QrCode className="w-32 h-32 text-[#00B1EA]" />
                  </div>
                  <div className="relative">
                    <div className="w-48 h-48 bg-slate-50 rounded-xl mx-auto border-2 border-dashed border-slate-200 flex flex-col items-center justify-center relative overflow-hidden mb-4 shadow-sm">
                      {/* Fake QR CODE PATTERN */}
                      <div className="absolute inset-2" style={{ backgroundImage: 'radial-gradient(circle, #0f172a 20%, transparent 20%)', backgroundSize: '10px 10px', opacity: 0.8 }} />
                      <div className="w-14 h-14 bg-white rounded-xl z-10 shadow-lg border border-slate-100 flex items-center justify-center">
                         <span className="text-[#00B1EA] font-black tracking-tighter text-2xl">pix</span>
                      </div>
                    </div>
                    
                    <p className="text-slate-600 text-sm mb-4">1. Abra o app do seu banco<br/> 2. Escolha pagar via <b>Pix QR Code</b> ou <b>Copia e Cola</b></p>
                    
                    <div className="relative group">
                      <input 
                        type="text" 
                        readOnly 
                        value="00020126580014br.gov.bcb.pix0136mock-..." 
                        className="w-full bg-slate-50 border border-slate-200 text-slate-500 text-xs font-mono py-3 pl-3 pr-24 rounded-xl outline-none"
                      />
                      <button 
                        onClick={handleCopyPix}
                        className={cn("absolute right-1 top-1 bottom-1 px-3 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm border", copied ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95")}
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? "Copiado!" : "Copiar"}
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-slate-500 text-xs px-2 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                  <Info className="w-5 h-5 shrink-0 text-blue-400" />
                  <p>Aprovação Imediata. Liberamos o agendamento de forma automática 🚀</p>
                </div>

                <button onClick={() => handleSimulatePayment('Pix')} disabled={processing} className="w-full bg-[#00B1EA] hover:bg-[#009bd1] text-white font-bold py-4 rounded-xl shadow-lg shadow-sky-500/30 transition-all flex justify-center items-center gap-2">
                  {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : "Fiz o Pagamento (Simular Api)"}
                </button>
              </div>
            )}

            {/* ABA CARTÃO */}
            {method === 'card' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 space-y-5">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 px-0.5">Número do Cartão</label>
                    <div className="relative">
                      <CreditCard className="w-5 h-5 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text" 
                        placeholder="0000 0000 0000 0000" 
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-mono tracking-widest pl-10 pr-3 py-3 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 px-0.5">Nome Impresso no Cartão</label>
                    <input 
                      type="text" 
                      placeholder="NOME COMO ESTÁ NO CARTÃO" 
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value.toUpperCase())}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-medium pl-3 pr-3 py-3 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 px-0.5">Validade</label>
                      <input 
                        type="text" 
                        placeholder="MM/AA" 
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-mono pl-3 pr-3 py-3 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 px-0.5">Código de Segurança (CVV)</label>
                      <input 
                        type="password" 
                        maxLength={4}
                        placeholder="***" 
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-mono pl-3 pr-3 py-3 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all text-center"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                     <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5 leading-tight text-center"><ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0"/> Seus dados corporativos são processados com Criptografia Militar pelo Mercado Pago.</p>
                  </div>
                </div>

                <button 
                  onClick={() => handleSimulatePayment('Cartão de Crédito/Débito')} 
                  disabled={processing || !cardNumber || !cardExpiry || !cardCvv} 
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-xl shadow-indigo-600/20 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : "Pagar c/ Cartão na Plataforma"}
                </button>
              </div>
            )}

            {/* ABA GOOGLE PAY */}
            {method === 'gpay' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 pt-2">
                 
                 <div className="text-center space-y-3 mb-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="w-20 h-20 bg-slate-900 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-black/10 mb-6 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
                      <span className="text-white text-3xl font-black font-sans -ml-1">G</span><span className="text-white text-xl font-medium mt-1">Pay</span>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 leading-tight">Pagamento Expresso</h3>
                    <p className="text-sm text-slate-500 px-4">Pague usando os cartões salvos na sua conta Google sem precisar digitar números.</p>
                 </div>

                 <button 
                    onClick={() => handleSimulatePayment('Google Pay Wallet')}
                    className="w-full bg-slate-900 text-white hover:bg-black py-4 rounded-xl flex items-center justify-center gap-3 transition-transform hover:scale-[1.02] active:scale-95 shadow-xl shadow-black/20"
                 >
                    <span className="font-bold text-base">Pagar com Módulo</span>
                    <span className="text-white text-lg font-black font-sans -ml-1 flex items-center gap-0.5"><span className="text-xl">G</span>Pay</span>
                 </button>
                 
                 <div className="flex justify-center mt-2">
                   <p className="text-[11px] text-slate-400 mt-2 text-center max-w-[200px]">A verificação será enviada para o seu relógio ou celular via NFC / Biometria.</p>
                 </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
