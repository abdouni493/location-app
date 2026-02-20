
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function getRentalAIAnalysis(
  category: string,
  dataContext: any,
  language: 'fr' | 'ar'
) {
  try {
    // Get API key from environment - Vite uses import.meta.env
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error('VITE_GEMINI_API_KEY is not configured');
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const contextString = JSON.stringify(dataContext, null, 2);
    
    const systemInstruction = language === 'fr' 
      ? `Tu es un consultant expert en stratégie d'agences de location de voitures avec plus de 15 ans d'expérience. 
         Tu fournis des analyses détaillées, chiffrées et actionnables basées sur les données réelles.
         Tes analyses incluent toujours :
         1. Un diagnostic précis de la situation actuelle
         2. L'identification des points forts à valoriser
         3. L'identification des points faibles à corriger
         4. Des recommandations spécifiques et chiffrées
         5. Un plan d'action avec des étapes concrètes
         6. Des KPIs à suivre pour mesurer le succès`
      : `أنت مستشار خبير في استراتيجية وكالات تأجير السيارات بخبرة تزيد عن 15 سنة.
         تقدم تحليلات مفصلة وقائمة على البيانات وقابلة للتنفيذ.
         تشمل تحليلاتك دائماً:
         1. تشخيص دقيق للوضع الحالي
         2. تحديد نقاط القوة التي يجب الاستفادة منها
         3. تحديد نقاط الضعف التي يجب معالجتها
         4. توصيات محددة وذات أرقام
         5. خطة عمل مع خطوات ملموسة
         6. مؤشرات الأداء الرئيسية للمتابعة`;

    const prompt = language === 'fr'
      ? `CONTEXTE: Vous analysez une agence de location de voitures.
         CATÉGORIE D'ANALYSE: ${category}
         DONNÉES ACTUELLES: ${contextString}
         
         Fournissez une analyse COMPLÈTE et DÉTAILLÉE incluant:
         
         📊 DIAGNOSTIC DE SITUATION:
         - État actuel du business (points forts, points faibles)
         - Comparaison avec les standards du secteur
         - Tendances observées
         
         🎯 RECOMMANDATIONS STRATÉGIQUES:
         - 3-5 actions prioritaires à mettre en œuvre immédiatement
         - Impact estimé en termes financiers
         - Délai de mise en œuvre
         
         💡 CONSEILS PRATIQUES:
         - Comment optimiser les opérations
         - Comment augmenter la rentabilité
         - Comment améliorer la satisfaction client
         
         📈 OBJECTIFS À COURT/MOYEN TERME:
         - Objectifs mesurables pour les 3 prochains mois
         - Objectifs pour les 6-12 prochains mois
         
         Format: Clair, professionnel, facile à comprendre et mettre en œuvre.`
      : `السياق: أنت تقوم بتحليل وكالة لتأجير السيارات.
         فئة التحليل: ${category}
         البيانات الحالية: ${contextString}
         
         قدم تحليلاً كاملاً وتفصيلياً يشمل:
         
         📊 تشخيص الوضع:
         - الحالة الحالية للعمل (نقاط القوة والضعف)
         - المقارنة مع معايير الصناعة
         - الاتجاهات الملحوظة
         
         🎯 التوصيات الاستراتيجية:
         - 3-5 إجراءات ذات أولوية يجب تنفيذها فوراً
         - الأثر المقدر من الناحية المالية
         - جدول الزمني للتنفيذ
         
         💡 نصائح عملية:
         - كيفية تحسين العمليات
         - كيفية زيادة الربحية
         - كيفية تحسين رضا العملاء
         
         📈 الأهداف على المدى القصير/المتوسط:
         - أهداف قابلة للقياس للثلاثة أشهر القادمة
         - أهداف للأشهر 6-12 القادمة
         
         الصيغة: واضحة احترافية وسهلة الفهم والتنفيذ.`;

    const response = await model.generateContent({
      contents: [{
        role: "user",
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 3000
      }
    });

    const result = await response.response;
    return result.text();
  } catch (error: any) {
    console.error("AI Analysis failed:", error);
    const errorMessage = error?.message || 'Unknown error';
    
    if (errorMessage.includes('VITE_GEMINI_API_KEY')) {
      return language === 'fr' 
        ? "❌ Clé API Gemini non configurée. Veuillez ajouter VITE_GEMINI_API_KEY à votre fichier .env" 
        : "❌ مفتاح API Gemini غير مكون. يرجى إضافة VITE_GEMINI_API_KEY إلى ملف .env الخاص بك";
    }
    
    return language === 'fr' 
      ? `❌ Erreur: ${errorMessage}` 
      : `❌ خطأ: ${errorMessage}`;
  }
}
