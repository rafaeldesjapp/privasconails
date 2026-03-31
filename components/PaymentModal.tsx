import React, { useState, useEffect } from 'react';
import { X, QrCode, CreditCard, CheckCircle2, Copy, ShieldCheck, Lock, Smartphone, Check, Loader2, Info, Users, Minus, Plus } from 'lucide-react';
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
  
  // Dynamic Pricing
  const [multiplier, setMultiplier] = useState(1);
  const [basePrice, setBasePrice] = useState(amount || 50);
  const [calculatedTotal, setCalculatedTotal] = useState(amount || 50);
  
  // Real PIX Data
  const [pixString, setPixString] = useState('');
  const [pixImage, setPixImage] = useState('');
  const [paymentId, setPaymentId] = useState('');

  // Card Form
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // Limpa os estados ao fechar ou reabrir
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setPixString('');
      setPixImage('');
      setPaymentId('');
      setProcessing(false);
    } else {
      document.body.style.overflow = '';
      setMultiplier(1);
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Load real price from DB
  useEffect(() => {
    const loadPrice = async () => {
      const { data } = await supabase.from('configuracoes').select('valor').eq('id', 'tabela_precos').maybeSingle();
      if (!data?.valor || !Array.isArray(data.valor)) {
         setBasePrice(amount || 50);
         return;
      }

      const parts = serviceName.split(' + ');
      let totalVal = 0;
        
        parts.forEach(part => {
           let searchName = part;
           let qty = 1;
           const match = part.match(/^(\d+)x\s+(.*)$/);
           if (match) {
             qty = Number(match[1]);
             searchName = match[2];
           }
           
           let partPrice = 0;
           for (const cat of data.valor) {
             if (cat.itens) {
               const itMatch = cat.itens.find((i: any) => i.nome === searchName);
               if (itMatch && itMatch.preco) {
                  partPrice = Number(itMatch.preco);
                  break;
               }
             }
           }
           
           if (partPrice === 0 && Array.isArray(parts) && parts.length === 1) {
             partPrice = amount || 50;
           } else if (partPrice === 0) {
             partPrice = 50;
           }
           
           totalVal += partPrice * qty;
        });

        setBasePrice(totalVal);
    };
    if (isOpen && serviceName) {
      loadPrice();
    }
  }, [isOpen, serviceName, amount]);

  // Update calculated total
  useEffect(() => {
    setCalculatedTotal(basePrice * multiplier);
  }, [basePrice, multiplier]);

  if (!isOpen) return null;

  const fmtValue = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleCopyPix = () => {
    if(!pixString) return;
    navigator.clipboard.writeText(pixString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Chama a API Backend Real
  const handleGenerateRealPayment = async (chosenMethod: 'pix' | 'card' | 'gpay') => {
    if (processing) return;
    setProcessing(true);
    
    try {
      const res = await fetch('/api/pagamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: calculatedTotal,
          serviceName: multiplier > 1 ? `${multiplier}x ${serviceName}` : serviceName,
          appointmentId: appointmentId,
          method: chosenMethod
        })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao processar pagamento.');
      }

      if (chosenMethod === 'pix') {
         // Exibe o PIX do Banco Central na tela!
         setPixString(data.qr_code);
         setPixImage(data.qr_code_base64);
         setPaymentId(data.id);
      } else {
         // Sucesso instantâneo para fluxos de cartão que estamos apenas simulando finalização
         await finalizeOrder(chosenMethod);
      }
      
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      if (chosenMethod !== 'pix') {
         setProcessing(false); 
      } else {
         setProcessing(false);
      }
    }
  };

  // Atualiza Agendamento no Banco (WebHook/Simulacao manual)
  const finalizeOrder = async (metodoNome: string) => {
     try {
       const nomeFormatado = metodoNome === 'pix' ? 'Pix (Mercado Pago)' : metodoNome === 'card' ? 'Cartão de Crédito' : 'Google Pay';
       const { error } = await supabase.from('agendamentos').update({
          payment_method: nomeFormatado
       }).eq('id', appointmentId);

       if (onPaymentSuccess) onPaymentSuccess(nomeFormatado);
       alert(`🎉 APROVADO! Pagamento Registrado (${metodoNome}).`);
       onClose();
     } catch (e) {
       console.error("Erro ao finalizar:", e);
     }
  };

  const formatCardNumber = (val: string) => val.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().substring(0, 19);
  const formatExpiry = (val: string) => {
    let clean = val.replace(/\D/g, '').substring(0, 4);
    if (clean.length >= 3) return `${clean.substring(0, 2)}/${clean.substring(2, 4)}`;
    return clean;
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end md:justify-center items-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm transition-all duration-300">
      
      <div className="bg-white w-full max-w-md h-[95vh] md:h-auto md:max-h-[90vh] rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col relative overflow-hidden transform transition-transform animate-slide-up md:animate-in md:zoom-in-95">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2 text-slate-700">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <span className="font-bold text-sm tracking-tight text-slate-800">Checkout Seguro Mercado Pago</span>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors bg-white shadow-sm border border-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-6 border-b border-slate-100 bg-white shrink-0 shadow-[0_10px_20px_rgba(0,0,0,0.02)] relative z-10">
          <p className="text-sm font-medium text-slate-500 mb-2">Você está pagando por:</p>
          <div className="flex flex-col gap-1.5 mb-4">
            {serviceName.split(' + ').map((part, idx) => (
              <div key={idx} className="flex items-center text-slate-800">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2 shrink-0"></span>
                <h2 className="text-base font-black line-clamp-1 pr-4">{part}</h2>
              </div>
            ))}
            <div className="flex justify-between items-end mt-2 pt-3 border-t border-slate-100">
               <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Subtotal Base</span>
               <div className="text-2xl font-black text-blue-600 tabular-nums">{fmtValue(calculatedTotal / multiplier)}</div>
            </div>
            {multiplier > 1 && (
              <div className="flex justify-between items-end">
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Final ({multiplier}x)</span>
                 <div className="text-xl font-black text-blue-800 tabular-nums">{fmtValue(calculatedTotal)}</div>
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div className="flex items-center gap-2 text-slate-600">
              <Users className="w-4 h-4" />
              <span className="text-sm font-bold">Pessoas / Multiplicador</span>
            </div>
            <div className="flex items-center gap-3 bg-white px-2 py-1.5 rounded-lg border border-slate-200 shadow-sm">
              <button 
                onClick={() => setMultiplier(Math.max(1, multiplier - 1))}
                className="w-6 h-6 flex items-center justify-center rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition-all"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-black text-sm w-4 text-center tabular-nums">{multiplier}</span>
              <button 
                onClick={() => setMultiplier(Math.min(10, multiplier + 1))}
                className="w-6 h-6 flex items-center justify-center rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition-all"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 relative pb-10">
          <div className="p-5 sm:p-6 space-y-4">
            
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
                
                {!pixString ? (
                   <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
                     <QrCode className="w-16 h-16 text-[#00B1EA] mx-auto mb-4" />
                     <h3 className="font-bold text-lg text-slate-800 mb-2">Pague com PIX</h3>
                     <p className="text-slate-500 text-sm mb-6">O código Pix será gerado instantaneamente na sua tela pelo Mercado Pago.</p>
                     
                     <button 
                       onClick={() => handleGenerateRealPayment('pix')} 
                       disabled={processing} 
                       className="w-full bg-[#00B1EA] hover:bg-[#009bd1] text-white font-bold py-4 rounded-xl shadow-lg shadow-sky-500/30 transition-all flex justify-center items-center gap-2"
                     >
                        {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : "Gerar Código Copia e Cola"}
                     </button>
                   </div>
                ) : (
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center relative overflow-hidden animate-in zoom-in-95">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                       <QrCode className="w-32 h-32 text-emerald-500" />
                    </div>
                    <div className="relative">
                      {pixImage && (
                        <div className="w-48 h-48 bg-white p-2 rounded-xl mx-auto border-2 border-slate-200 flex flex-col items-center justify-center relative shadow-sm mb-4">
                           <img src={`data:image/png;base64,${pixImage}`} alt="QR Code Pix" className="w-full h-full object-contain mix-blend-multiply" />
                        </div>
                      )}
                      
                      <p className="text-slate-600 text-sm mb-4">1. Abra o app do seu banco<br/> 2. Escolha **Pix Copia e Cola** ou Escaneie o QR Code.</p>
                      
                      <div className="relative group mb-6">
                        <input 
                          type="text" 
                          readOnly 
                          value={pixString} 
                          className="w-full bg-slate-50 border border-slate-200 text-slate-500 text-[10px] font-mono py-4 pl-3 pr-24 rounded-xl outline-none truncate"
                        />
                        <button 
                          onClick={handleCopyPix}
                          className={cn("absolute right-1 top-1 bottom-1 px-3 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm border", copied ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95")}
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copied ? "Copiado!" : "Copiar"}
                        </button>
                      </div>

                      <div className="flex flex-col gap-2">
                         <div className="flex items-center justify-center gap-2 text-emerald-600 text-xs font-bold mb-2">
                           <Loader2 className="w-4 h-4 animate-spin" /> Aguardando o seu pagamento...
                         </div>
                         <button 
                           onClick={() => finalizeOrder('pix')}
                           className="text-[10px] underline text-slate-400 font-medium hover:text-slate-600 p-2"
                         >
                            Já Paguei (Liberar Agendador Mockup)
                         </button>
                      </div>
                    </div>
                  </div>
                )}
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
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 px-0.5">CVV</label>
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
                     <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5 leading-tight text-center">
                        <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0"/> Proc. via Mercado Pago
                     </p>
                  </div>
                </div>

                <button 
                  onClick={() => handleGenerateRealPayment('card')} 
                  disabled={processing || !cardNumber || !cardExpiry || !cardCvv} 
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-xl shadow-indigo-600/20 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : "Pagar c/ Cartão Seguro"}
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
                    <p className="text-sm text-slate-500 px-4">Pague usando os cartões do seu celular de forma rápida e segura.</p>
                 </div>

                 <button 
                    onClick={() => handleGenerateRealPayment('gpay')}
                    disabled={processing}
                    className="w-full bg-black text-white hover:bg-slate-800 py-4 rounded-xl flex items-center justify-center gap-3 transition-transform hover:scale-[1.02] active:scale-95 shadow-xl shadow-black/20"
                 >
                    {processing ? <Loader2 className="w-5 h-5 animate-spin text-white" /> : (
                       <>
                         <span className="font-bold text-base">Pagar com Módulo</span>
                         <span className="text-white text-lg font-black font-sans -ml-1 flex items-center gap-0.5"><span className="text-xl">G</span>Pay</span>
                       </>
                    )}
                 </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
