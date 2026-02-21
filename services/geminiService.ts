import OpenAI from "openai";

type Lang = 'fr' | 'ar';

export async function getRentalAIAnalysis(category: string, dataContext: any, language: Lang) {
  const provider = (import.meta.env.VITE_AI_PROVIDER || 'openai').toLowerCase();

  const contextString = JSON.stringify(dataContext, null, 2);

  // Fetch current exchange rate EUR -> DZD and timestamp to provide real-time conversion
  let eurToDzd = 1;
  let rateTimestamp = new Date().toISOString();
  try {
    const rateResp = await fetch('https://api.exchangerate.host/latest?base=EUR&symbols=DZD');
    if (rateResp.ok) {
      const rateJson = await rateResp.json();
      if (rateJson && rateJson.rates && rateJson.rates.DZD) {
        eurToDzd = Number(rateJson.rates.DZD) || eurToDzd;
        rateTimestamp = rateJson.date ? new Date(rateJson.date).toISOString() : rateTimestamp;
      }
    }
  } catch (e) {
    console.warn('Exchange rate lookup failed, defaulting EUR->DZD=1', e);
  }

  const systemInstruction = language === 'fr'
    ? `Tu es un consultant senior et analyste financier spécialisé dans les agences de location de voitures avec plus de 15 ans d'expérience. Fournis une analyse professionnelle, approfondie et structurée, avec des recommandations actionnables (conseils). Présente les résultats de manière claire, chiffrée et priorisée.`
    : `أنت مستشار أول ومحلل مالي متخصص في وكالات تأجير السيارات بخبرة تزيد عن 15 سنة. قدّم تحليلاً محترفًا وعميقًا ومنظمًا، مع توصيات قابلة للتنفيذ (نصائح). اعرض النتائج بطريقة واضحة، مُرقمة ومُعززة بالأرقام.`;

  const promptBase = language === 'fr'
    ? `CONTEXTE: Vous analysez une agence de location de voitures.\\nCATÉGORIE D'ANALYSE: ${category}\\nDONNÉES: ${contextString}`
    : `السياق: تقوم بتحليل وكالة لتأجير السيارات.\\nفئة التحليل: ${category}\\nالبيانات: ${contextString}`;

  const conversionNote = language === 'fr'
    ? `Utilisez la monnaie locale: DZD (Dinar algérien). Taux actuel fourni: 1 EUR = ${eurToDzd} DZD (source: exchangerate.host, date: ${rateTimestamp}). Convertissez toutes les valeurs monétaires exprimées en EUR vers DZD, affichez les calculs et arrondissez à 2 décimales.`
    : `استخدم العملة المحلية: الدينار الجزائري (DZD). سعر الصرف الحالي: 1 يورو = ${eurToDzd} DZD (المصدر: exchangerate.host، التاريخ: ${rateTimestamp}). حوّل كل القيم النقدية من يورو إلى دينار جزائري، واعرض الحسابات مع التقريب إلى خانتين عشريتين.`;

  const domainsList = language === 'fr'
    ? ['Stratégie Globale', 'Gestion de Flotte', 'Analyse Clientèle', 'Rentabilité & Frais', 'Opérations']
    : ['الاستراتيجية العامة', 'إدارة الأسطول', 'تحليل العملاء', 'الربحية والتكاليف', 'العمليات'];

  const detailedInstructions = language === 'fr'
    ? `Pour CHAQUE domaine suivant: ${domainsList.join(' — ')}\n1) Fournissez un diagnostic détaillé avec les causes racines (chiffres à l'appui), 2) Listez les mesures immédiates (1-3 actions rapides), 3) Proposez une feuille de route à 90 jours (5 actions) avec priorités, estimations de coûts et bénéfices (en DZD), 4) Indiquez les KPI à suivre et seuils d'alerte, 5) Évaluez l'impact attendu sur le résultat net en DZD et en %.`
    : `لكل مجال من المجالات التالية: ${domainsList.join(' — ')}\n1) قدّم تشخيصًا تفصيليًا مع الأسباب الجذرية (مؤشرات رقمية داعمة)، 2) سلّك إجراءات فورية (1-3 إجراءات سريعة)، 3) اقترح خارطة طريق لمدة 90 يومًا (5 إجراءات) مع الأولويات وتقديرات التكاليف والفوائد (بالدينار الجزائري)، 4) حدد مؤشرات الأداء (KPIs) وحدود الإنذار، 5) قيّم الأثر المتوقع على صافي الربح بالدينار الجزائري وبالنسبة المئوية.`;

  const prompt = `${promptBase}\\n\\n${conversionNote}\\n\\n${detailedInstructions}\\n\\nRéponse attendue: commencez par un bref résumé exécutif (3-5 phrases), puis une section par domaine (diagnostic, causes, actions rapides, feuille de route 90j, KPI, estimation d'impact en DZD et %). Terminez par une liste priorisée de 10 actions avec échéances et ordre de priorité.`;

  try {
    if (provider === 'mock') {
      return language === 'fr'
        ? `✅ Analyse mock pour la catégorie ${category} — (données synthétiques).`
        : `✅ تحليل تجريبي لفئة ${category} — (بيانات صناعية).`;
    }

    if (provider === 'custom') {
      const apiUrl = import.meta.env.VITE_CUSTOM_AI_URL;
      const apiKey = import.meta.env.VITE_CUSTOM_API_KEY || import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiUrl || !apiKey) throw new Error('VITE_CUSTOM_AI_URL or VITE_CUSTOM_API_KEY not configured');

      const authHeaderName = import.meta.env.VITE_CUSTOM_AUTH_HEADER || 'Authorization';
      const authHeaderValue = authHeaderName === 'Authorization' ? `Bearer ${apiKey}` : apiKey;

      const isGoogle = apiUrl.includes('generativelanguage.googleapis.com') || (import.meta.env.VITE_CUSTOM_PROVIDER_TYPE === 'google');

      const headersObj: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authHeaderName && authHeaderName.toLowerCase() !== 'none') {
        headersObj[authHeaderName] = authHeaderValue;
      }

      let res;
      if (isGoogle) {
        // Google Generative Language API: allow specifying model via VITE_CUSTOM_MODEL
        const modelName = import.meta.env.VITE_CUSTOM_MODEL || undefined;

        // Helper to append key to URL if needed
        const appendKey = (url: string, key: string) => {
          if (!key) return url;
          if (url.includes('key=')) return url;
          return url.includes('?') ? `${url}&key=${encodeURIComponent(key)}` : `${url}?key=${encodeURIComponent(key)}`;
        };

        let finalUrl = apiUrl;
        // If the provided apiUrl doesn't already target a model:generateContent endpoint, build it
        if (!/:(generateContent|batchGenerateContent|bidiGenerateContent)\b/.test(apiUrl)) {
          // If apiUrl ends with '/models' or '/v1beta/models' etc, append model name
          const base = apiUrl.replace(/\/$/, '');
          if (modelName) {
            // If apiUrl already contains '/models', attach modelName, else assume apiUrl is the base and append '/models/{modelName}:generateContent'
            if (/\/models\//.test(base) || /\/models$/.test(base)) {
              // remove trailing '/models' if present so we don't double it
              finalUrl = base.replace(/\/models\/?$/, '') + `/models/${modelName}:generateContent`;
            } else {
              finalUrl = base + `/models/${modelName}:generateContent`;
            }
          } else {
            // no model provided and apiUrl doesn't include generateContent — just use apiUrl (best-effort)
            finalUrl = base;
          }
        }

        // If caller opted to not send Authorization header (e.g. keys via query), append key to URL
        if (authHeaderName && authHeaderName.toLowerCase() === 'none') {
          finalUrl = appendKey(finalUrl, apiKey);
        }

        const googleBody = {
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: Number(import.meta.env.VITE_CUSTOM_TEMPERATURE || 0.2),
            maxOutputTokens: Number(import.meta.env.VITE_CUSTOM_MAX_OUTPUT_TOKENS || 4000)
          }
        };

        res = await fetch(finalUrl, {
          method: 'POST',
          headers: headersObj,
          body: JSON.stringify(googleBody)
        });
      } else {
        const body = {
          model: import.meta.env.VITE_CUSTOM_MODEL || 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 2000
        };

        res = await fetch(apiUrl, {
          method: 'POST',
          headers: headersObj,
          body: JSON.stringify(body)
        });
      }

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Custom provider error ${res.status}: ${txt}`);
      }

      const json = await res.json();
      const content = json?.choices?.[0]?.message?.content || json?.choices?.[0]?.text || json?.result || json?.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(json);
      return content;
    }

    // Default: OpenAI
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) throw new Error('VITE_OPENAI_API_KEY is not configured');

    const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    const response = await client.chat.completions.create({
      model: import.meta.env.VITE_OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    const result = response.choices?.[0]?.message?.content;
    if (!result) throw new Error('No response from OpenAI');
    return result;
  } catch (error: any) {
    console.error('AI Analysis failed:', error);
    const msg = (error?.message || 'Unknown error') as string;
    if (msg.includes('not configured') || msg.includes('VITE_CUSTOM_AI_URL') || msg.includes('VITE_OPENAI_API_KEY')) {
      return language === 'fr'
        ? '❌ Clé/API non configurée. Vérifiez vos variables d\'environnement.'
        : '❌ مفتاح/واجهة برمجة التطبيقات غير مكون. تحقق من متغيرات البيئة.';
    }
    if (msg.includes('401') || msg.toLowerCase().includes('unauthorized')) {
      return language === 'fr'
        ? "❌ Erreur: Clé API invalide ou expirée. Vérifiez votre clé." 
        : "❌ خطأ: مفتاح API غير صالح أو منتهي الصلاحية. تحقق من مفتاحك.";
    }
    return language === 'fr' ? `❌ Erreur: ${msg}` : `❌ خطأ: ${msg}`;
  }
}
