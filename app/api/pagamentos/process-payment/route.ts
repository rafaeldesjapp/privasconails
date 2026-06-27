import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

// Inicializa SDK do Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || '',
});
function generateValidCPF(): string {
  const num = () => Math.floor(Math.random() * 9);
  const n1 = num(), n2 = num(), n3 = num(), n4 = num(), n5 = num(), n6 = num(), n7 = num(), n8 = num(), n9 = num();
  
  let d1 = n9*2 + n8*3 + n7*4 + n6*5 + n5*6 + n4*7 + n3*8 + n2*9 + n1*10;
  d1 = 11 - (d1 % 11);
  if (d1 >= 10) d1 = 0;
  
  let d2 = d1*2 + n9*3 + n8*4 + n7*5 + n6*6 + n5*7 + n4*8 + n3*9 + n2*10 + n1*11;
  d2 = 11 - (d2 % 11);
  if (d2 >= 10) d2 = 0;
  
  return `${n1}${n2}${n3}${n4}${n5}${n6}${n7}${n8}${n9}${d1}${d2}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { 
      transaction_amount, 
      token, 
      description, 
      installments, 
      payment_method_id, 
      issuer_id, 
      payer, 
      appointmentIds,
      userId,
      clientName,
      creditCard,
      creditCardHolderInfo,
      gateway,
      saveCard,
      creditCardToken
    } = body;

    // Validate request
    if (!transaction_amount || !appointmentIds || appointmentIds.length === 0) {
      return NextResponse.json({ error: 'Faltam parâmetros essenciais (Preço ou Comandas)' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Erro de infraestrutura (Supabase não configurado)' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Buscar configs do banco
    const { data: configs } = await supabaseAdmin.from('configuracoes').select('id, valor');
    const activeGatewayObj = configs?.find((c: any) => c.id === 'ACTIVE_GATEWAY');
    const activeGateway = gateway || activeGatewayObj?.valor || 'mercado_pago';

    // Buscar perfil do usuário para CPF e Cartão Salvo
    let userProfile: any = null;
    if (userId) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('cpf, asaas_card_token, asaas_card_brand, asaas_card_last_digits, mp_customer_id')
        .eq('id', userId)
        .single();
      userProfile = data;
    }

    if (activeGateway === 'asaas') {
      const asaasApiKeyObj = configs?.find((c: any) => c.id === 'ASAAS_API_KEY');
      const asaasDevWalletIdObj = configs?.find((c: any) => c.id === 'ASAAS_DEV_WALLET_ID');
      const asaasEnvObj = configs?.find((c: any) => c.id === 'ASAAS_ENV');

      const asaasApiKey = asaasApiKeyObj?.valor;
      const asaasDevWalletId = asaasDevWalletIdObj?.valor;
      const asaasEnv = asaasEnvObj?.valor || 'sandbox';

      if (!asaasApiKey) {
        return NextResponse.json({ error: 'Integração do Asaas não configurada. Por favor configure a API Key nas configurações de pagamento.' }, { status: 400 });
      }

      if (Number(transaction_amount) < 5.00) {
        return NextResponse.json({ 
          error: 'O valor mínimo para pagamentos online via Asaas é de R$ 5,00. Por favor, adicione mais serviços à comanda ou utilize outra forma de pagamento.' 
        }, { status: 400 });
      }

      const asaasBaseUrl = asaasEnv === 'production' 
        ? 'https://api.asaas.com/v3' 
        : 'https://api-sandbox.asaas.com/v3';

      const asaasHeaders = {
        'Content-Type': 'application/json',
        'access_token': asaasApiKey
      };

      // 1. Criar ou buscar cliente
      let asaasCustomerId: string;
      try {
        const searchEmail = payer?.email || 'cliente@privasconails.com';
        const searchRes = await fetch(`${asaasBaseUrl}/customers?email=${encodeURIComponent(searchEmail)}`, {
          method: 'GET',
          headers: asaasHeaders
        });
        
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData.data && searchData.data.length > 0) {
            const foundCustomer = searchData.data[0];
            asaasCustomerId = foundCustomer.id;
            
            // Se o cliente não tiver CPF/CNPJ, atualiza o cadastro com o CPF salvo ou mock no sandbox
            if (!foundCustomer.cpfCnpj) {
              const actualCpf = userProfile?.cpf || (creditCardHolderInfo?.cpfCnpj ? creditCardHolderInfo.cpfCnpj.replace(/\D/g, '') : null);
              if (actualCpf) {
                await fetch(`${asaasBaseUrl}/customers/${asaasCustomerId}`, {
                  method: 'POST',
                  headers: asaasHeaders,
                  body: JSON.stringify({ cpfCnpj: actualCpf })
                });
              } else if (asaasEnv === 'sandbox') {
                const mockCpf = generateValidCPF();
                const updateRes = await fetch(`${asaasBaseUrl}/customers/${asaasCustomerId}`, {
                  method: 'POST',
                  headers: asaasHeaders,
                  body: JSON.stringify({
                    cpfCnpj: mockCpf
                  })
                });
                if (!updateRes.ok) {
                  const errText = await updateRes.text();
                  console.error('Erro ao atualizar CPF do cliente no Sandbox:', errText);
                }
              } else {
                // Em produção, retorna erro avisando da falta do CPF
                return NextResponse.json({ 
                  error: 'Para realizar cobranças via Asaas, o cliente precisa possuir o CPF/CNPJ cadastrado no Asaas. Por favor, atualize o cadastro do cliente no Asaas.' 
                }, { status: 400 });
              }
            }
          } else {
            // Criar novo cliente
            const payload: any = {
              name: clientName || 'Cliente Padrão',
              email: searchEmail,
              notificationDisabled: true
            };
            
            const actualCpf = userProfile?.cpf || (creditCardHolderInfo?.cpfCnpj ? creditCardHolderInfo.cpfCnpj.replace(/\D/g, '') : null);
            if (actualCpf) {
              payload.cpfCnpj = actualCpf;
            } else if (asaasEnv === 'sandbox') {
              payload.cpfCnpj = generateValidCPF();
            } else {
              // Em produção, barramos
              return NextResponse.json({ 
                error: 'Para realizar cobranças via Asaas, o cliente precisa possuir um CPF/CNPJ cadastrado. Por favor, cadastre o cliente com CPF no Asaas primeiro.' 
              }, { status: 400 });
            }

            const createRes = await fetch(`${asaasBaseUrl}/customers`, {
              method: 'POST',
              headers: asaasHeaders,
              body: JSON.stringify(payload)
            });
            if (!createRes.ok) {
              const errText = await createRes.text();
              throw new Error(errText);
            }
            const createData = await createRes.json();
            asaasCustomerId = createData.id;
          }
        } else {
          const errText = await searchRes.text();
          throw new Error(errText);
        }
      } catch (err: any) {
        console.error('Erro ao obter cliente Asaas:', err);
        return NextResponse.json({ error: `Erro ao obter/criar cliente no Asaas: ${err.message}` }, { status: 500 });
      }

      // 2. Criar cobrança no Asaas
      const isPix = payment_method_id === 'pix';
      const billingType = isPix ? 'PIX' : 'CREDIT_CARD';
      const todayStr = new Date().toISOString().split('T')[0];

      // Configuração de Split de 95% para a Cliente (Subconta)
      const splitArr: any[] = [];
      if (asaasDevWalletId) {
        let isOwnWallet = false;
        try {
          const walletsRes = await fetch(`${asaasBaseUrl}/wallets`, {
            method: 'GET',
            headers: asaasHeaders
          });
          if (walletsRes.ok) {
            const walletsData = await walletsRes.json();
            const ownWalletId = walletsData.walletId || (Array.isArray(walletsData.data) ? walletsData.data[0]?.id : null);
            if (ownWalletId && ownWalletId === asaasDevWalletId) {
              isOwnWallet = true;
            }
          }
        } catch (e) {
          console.error('Erro ao validar Wallet ID da própria conta:', e);
        }

        if (!isOwnWallet) {
          splitArr.push({
            walletId: asaasDevWalletId,
            percentualValue: 95.00
          });
        } else {
          console.log('Split ignorado porque a carteira destino é igual à carteira de origem (Master).');
        }
      }

      const chargePayload: any = {
        customer: asaasCustomerId,
        billingType: billingType,
        value: Number(transaction_amount),
        dueDate: todayStr,
        description: description || 'Serviços de Salão de Beleza',
        split: splitArr.length > 0 ? splitArr : undefined
      };

      if (!isPix) {
        if (creditCardToken) {
          chargePayload.creditCardToken = creditCardToken;
        } else if (creditCard && creditCardHolderInfo) {
          const clientIp = req.headers.get('x-forwarded-for') || '127.0.0.1';
          chargePayload.creditCard = creditCard;
          chargePayload.creditCardHolderInfo = {
            ...creditCardHolderInfo,
            remoteIp: clientIp.split(',')[0].trim()
          };
        }
      }

      let asaasPayment: any;
      try {
        const chargeRes = await fetch(`${asaasBaseUrl}/payments`, {
          method: 'POST',
          headers: asaasHeaders,
          body: JSON.stringify(chargePayload)
        });
        if (!chargeRes.ok) {
          const errText = await chargeRes.text();
          throw new Error(errText);
        }
        asaasPayment = await chargeRes.json();
      } catch (err: any) {
        console.error('Erro ao gerar cobrança Asaas:', err);
        return NextResponse.json({ error: `Erro ao gerar cobrança no Asaas: ${err.message}` }, { status: 500 });
      }

      // 3. Verificar se o pagamento com cartão de crédito foi aprovado na hora
      const isApproved = !isPix && (creditCard || creditCardToken) && ['CONFIRMED', 'RECEIVED'].includes(asaasPayment.status);

      // Salvar transação localmente
      await supabaseAdmin.from('transacoes').insert({
         user_id: userId || null,
         client_name: clientName || 'Desconhecido',
         amount: Number(transaction_amount),
         payment_method: isPix ? 'pix_asaas' : 'cartao_asaas',
         status: isApproved ? 'approved' : 'pending',
         services_desc: description || 'Serviços de Salão',
         mp_id: asaasPayment.id?.toString()
      });

      if (isApproved) {
        await supabaseAdmin
          .from('agendamentos')
          .update({ 
             status: 'concluido', 
             payment_method: 'online' 
          })
          .in('id', appointmentIds);

        // Atualizar CPF e salvar token do cartão no perfil se solicitado
        if (userId) {
          const updates: any = {};
          const inputCpf = creditCardHolderInfo?.cpfCnpj?.replace(/\D/g, '');
          if (inputCpf && inputCpf !== userProfile?.cpf) {
            updates.cpf = inputCpf;
          }
          if (saveCard && asaasPayment.creditCard?.creditCardToken) {
            updates.asaas_card_token = asaasPayment.creditCard.creditCardToken;
            updates.asaas_card_brand = asaasPayment.creditCard.creditCardBrand || 'Cartão';
            if (asaasPayment.creditCard.creditCardNumber) {
              updates.asaas_card_last_digits = asaasPayment.creditCard.creditCardNumber.slice(-4);
            }
          }
          if (Object.keys(updates).length > 0) {
            await supabaseAdmin.from('profiles').update(updates).eq('id', userId);
          }
        }
      }

      // 4. Se for PIX, puxar QR Code
      if (isPix) {
        try {
          const qrCodeRes = await fetch(`${asaasBaseUrl}/payments/${asaasPayment.id}/pixQrCode`, {
            method: 'GET',
            headers: asaasHeaders
          });
          if (!qrCodeRes.ok) {
            const errText = await qrCodeRes.text();
            throw new Error(errText);
          }
          const qrCodeData = await qrCodeRes.json();
          return NextResponse.json({
            id: asaasPayment.id,
            status: 'pending',
            status_detail: 'pending_waiting_transfer',
            qr_code: qrCodeData.payload,
            qr_code_base64: qrCodeData.encodedImage
          });
        } catch (err: any) {
          console.error('Erro ao obter QR Code Asaas:', err);
          return NextResponse.json({ error: `Cobrança criada (${asaasPayment.id}), mas falhou ao gerar QR Code: ${err.message}` }, { status: 500 });
        }
      }

      // Se for Cartão de Crédito Transparente (direto)
      if (!isPix && (creditCard || creditCardToken)) {
        return NextResponse.json({
          id: asaasPayment.id,
          status: isApproved ? 'approved' : 'rejected',
          status_detail: asaasPayment.status?.toLowerCase()
        });
      }

      // Se for link de fatura (sem cartão preenchido na chamada)
      return NextResponse.json({
        id: asaasPayment.id,
        status: 'pending',
        status_detail: 'invoice_created',
        invoiceUrl: asaasPayment.invoiceUrl
      });
    }

    // Instancia Pagamento no Mercado Pago
    const sellerAccessToken = configs?.find((c: any) => c.id === 'MERCADO_PAGO_SELLER_ACCESS_TOKEN')?.valor;
    const mpClient = sellerAccessToken
      ? new MercadoPagoConfig({ accessToken: sellerAccessToken })
      : client;

    const payment = new Payment(mpClient);
    
    // Configura idempotency para segurança do Cartão
    // Vamos gerar uma chave aleatória se não for repassada pelo header
    const idempotencyKey = req.headers.get('x-idempotency-key') || crypto.randomUUID();

    const requestBody: any = {
      transaction_amount: Number(transaction_amount),
      description: description || 'Serviços de Salão de Beleza',
      payment_method_id: payment_method_id,
      payer: {
        email: payer?.email || 'cliente@privasconails.com',
      }
    };

    if (token) requestBody.token = token;
    if (installments && !isNaN(Number(installments))) requestBody.installments = Number(installments);
    if (issuer_id) requestBody.issuer_id = issuer_id;
    if (payer?.identification && payer.identification.type && payer.identification.number) {
        requestBody.payer.identification = payer.identification;
    }

    // ---------------------------------------------------------------
    // Repasse de taxas ao cliente: ajusta transaction_amount com base
    // nas taxas de parcelamento configuradas em INSTALLMENT_FEES_TABLE
    // ---------------------------------------------------------------
    const feeTableConfig = configs?.find((c: any) => c.id === 'INSTALLMENT_FEES_TABLE')?.valor;
    // Taxas oficiais do Mercado Pago para Checkout Transparente (Receber na Hora D0)
    // Tarifas = Taxa básica de 4.99% + juros de parcelamento do vendedor
    const defaultFeeTable: Record<number, number> = {
      1:  4.99,   // à vista (4.99% processamento)
      2:  9.08,   // 4.99% + 4.09%
      3:  10.40,  // 4.99% + 5.41%
      4:  11.69,  // 4.99% + 6.70%
      5:  12.95,  // 4.99% + 7.96%
      6:  14.19,  // 4.99% + 9.20%
      7:  15.40,  // 4.99% + 10.41%
      8:  16.59,  // 4.99% + 11.60%
      9:  17.76,  // 4.99% + 12.77%
      10: 18.91,  // 4.99% + 13.92%
      11: 20.04,  // 4.99% + 15.05%
      12: 21.14,  // 4.99% + 16.15%
    };
    const feeTable: Record<number, number> = feeTableConfig || defaultFeeTable;
    const numInstallments = Number(installments) || 1;
    const feePercent = feeTable[numInstallments] ?? feeTable[12] ?? 21.14;

    if (token) {
      // Cálculo de divisão reversa para que o valor final líquido recebido seja exatamente o valor original.
      // Fórmula: Cobrado = Original / (1 - Taxa%)
      const originalAmount = Number(transaction_amount);
      const adjustedAmount = Number((originalAmount / (1 - feePercent / 100)).toFixed(2));
      requestBody.transaction_amount = adjustedAmount;
      console.log(`Installment fee (D0): ${numInstallments}x → Taxa ${feePercent}% | R$ ${originalAmount} → R$ ${adjustedAmount}`);
    }


    // Se o token do vendedor (cliente) estiver sendo usado via OAuth, aplica o split de 10% para a conta master (dev)
    // O formato do token do Mercado Pago é APP_USR-{CLIENT_ID}-{DATA}-{HASH}-{USER_ID}
    // Portanto, o Client ID sempre aparece no token, independente de quem autorizou.
    // Por isso, simplesmente sempre aplicamos a application_fee quando houver um sellerAccessToken.
    // Se o Mercado Pago rejeitar (mesmo vendedor que dono do app), o catch vai relançar sem a taxa.
    if (sellerAccessToken) {
      // application_fee calculado sobre o valor FINAL (já com a taxa repassada ao cliente)
      requestBody.application_fee = Number((requestBody.transaction_amount * 0.10).toFixed(2));
    }



    const result = await payment.create({
      body: requestBody,
      requestOptions: {
        idempotencyKey: idempotencyKey
      }
    });

    if (supabaseUrl && supabaseServiceKey) {
       // Salva extrato no novo cofre
       await supabaseAdmin.from('transacoes').insert({
          user_id: userId || null,
          client_name: clientName || 'Desconhecido',
          amount: Number(transaction_amount),
          payment_method: payment_method_id,
          status: result.status,
          services_desc: description || 'Serviços de Salão',
          mp_id: result.id?.toString()
       });

        if (result.status === 'approved') {
            await supabaseAdmin
             .from('agendamentos')
             .update({ 
                status: 'concluido', 
                payment_method: 'online' 
             })
             .in('id', appointmentIds);

            // Se aprovado, atualiza o CPF e salva os dados de pagamento (cartão) se solicitado
            if (saveCard && userId) {
              const updates: any = {};
              
              if (payer?.identification?.number) {
                const inputCpf = payer.identification.number.replace(/\D/g, '');
                if (inputCpf && inputCpf !== userProfile?.cpf) {
                  updates.cpf = inputCpf;
                }
              }
              
              if (token) {
                try {
                  let activeCustomerId = userProfile?.mp_customer_id;
                  const sellerAccessToken = configs?.find((c: any) => c.id === 'MERCADO_PAGO_SELLER_ACCESS_TOKEN')?.valor 
                    || process.env.MP_ACCESS_TOKEN;

                  if (!activeCustomerId && sellerAccessToken) {
                    const customerRes = await fetch('https://api.mercadopago.com/v1/customers', {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${sellerAccessToken}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        email: payer?.email || 'cliente@privasconails.com',
                        first_name: clientName || 'Cliente Padrão'
                      })
                    });
                    
                    if (customerRes.ok) {
                      const customerData = await customerRes.json();
                      if (customerData.id) {
                        activeCustomerId = customerData.id;
                        updates.mp_customer_id = activeCustomerId;
                      }
                    } else {
                      const errText = await customerRes.text();
                      console.error('Erro ao criar cliente no Mercado Pago:', errText);
                    }
                  }
                  
                  if (activeCustomerId && sellerAccessToken) {
                    const cardRes = await fetch(`https://api.mercadopago.com/v1/customers/${activeCustomerId}/cards`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${sellerAccessToken}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({ token: token })
                    });
                    
                    if (!cardRes.ok) {
                      const errText = await cardRes.text();
                      console.error('Erro ao salvar cartão do cliente no Mercado Pago:', errText);
                    } else {
                      console.log('Cartão associado com sucesso no Mercado Pago!');
                    }
                  }
                } catch (cardErr) {
                  console.error('Exceção ao salvar cartão no Mercado Pago:', cardErr);
                }
              }
              
              if (Object.keys(updates).length > 0) {
                await supabaseAdmin.from('profiles').update(updates).eq('id', userId);
              }
            }
        }
    }

    // Extrair dados do PIX se existirem
    const qr_code = result.point_of_interaction?.transaction_data?.qr_code;
    const qr_code_base64 = result.point_of_interaction?.transaction_data?.qr_code_base64;

    // Retorna para o Frontend reagir (seja approved, in_process, rejected, ou PIX pending)
    return NextResponse.json({
        id: result.id,
        status: result.status,
        status_detail: result.status_detail,
        qr_code: qr_code,
        qr_code_base64: qr_code_base64
    });

  } catch (error: any) {
    console.error('Erro no processamento do MercadoPago Brick:', error);
    if (error.cause) {
      console.error('Causa detalhada do erro MercadoPago:', JSON.stringify(error.cause, null, 2));
    }
    return NextResponse.json({ error: error.message || 'Erro Interno no Processamento' }, { status: 500 });
  }
}
