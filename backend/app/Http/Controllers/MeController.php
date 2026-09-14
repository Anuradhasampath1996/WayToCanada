<?php

namespace App\Http\Controllers;

use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeController extends Controller
{
    public function updateLocale(Request $request): JsonResponse
    {
        $data = $request->validate([
            'locale' => ['required', 'in:en,fr'],
        ]);

        $user = $request->user();
        $user->locale = $data['locale'];
        $user->save();

        return response()->json(new UserResource($user->fresh()));
    }

    public function dictionaries(Request $request): JsonResponse
    {
        $locale = $request->query('locale', $request->user()?->locale ?? 'en');
        if (! in_array($locale, ['en', 'fr'], true)) {
            $locale = 'en';
        }

        $en = [
            'catalog' => 'Catalog',
            'my_learning' => 'My Learning',
            'buy' => 'Buy',
            'buy_now' => 'Buy Now',
            'continue' => 'Continue',
            'continue_learning' => 'Continue Learning',
            'renew_access' => 'Renew Access',
            'start_course' => 'Start Course',
            'expired' => 'Expired',
            'preview' => 'Preview',
            'search' => 'Search',
            'target_exam' => 'Target exam',
            'category' => 'Category',
            'language' => 'Language',
            'price' => 'Price',
            'status' => 'Status',
            'hours' => 'Estimated hours',
            'difficulty' => 'Difficulty',
            'access_duration' => 'Access duration',
            'generate_course' => 'Generate Full Course with AI',
            'research_evidence' => 'Research / Evidence',
            'insufficient_question_pool' => 'Insufficient Question Pool',
            'coverage_gap' => 'Coverage Gap',
            'verified' => 'Verified',
            'review_required' => 'Review Required',
            'source_conflict' => 'Source Conflict',
            'citation_unverified' => 'Citation Unverified',
            'outdated' => 'Outdated',
            'critical_structure_unverified' => 'Critical Structure Unverified',
        ];
        $fr = [
            'catalog' => 'Catalogue',
            'my_learning' => 'Mon apprentissage',
            'buy' => 'Acheter',
            'buy_now' => 'Acheter',
            'continue' => 'Continuer',
            'continue_learning' => 'Continuer l’apprentissage',
            'renew_access' => 'Renouveler l’accès',
            'start_course' => 'Commencer le cours',
            'expired' => 'Expiré',
            'preview' => 'Aperçu',
            'search' => 'Recherche',
            'target_exam' => 'Examen cible',
            'category' => 'Catégorie',
            'language' => 'Langue',
            'price' => 'Prix',
            'status' => 'Statut',
            'hours' => 'Heures estimées',
            'difficulty' => 'Difficulté',
            'access_duration' => 'Durée d’accès',
            'generate_course' => 'Générer le cours complet avec l’IA',
            'research_evidence' => 'Recherche / Preuves',
            'insufficient_question_pool' => 'Banque de questions insuffisante',
            'coverage_gap' => 'Lacunes de couverture',
            'verified' => 'Vérifié',
            'review_required' => 'Révision requise',
            'source_conflict' => 'Conflit de sources',
            'citation_unverified' => 'Citation non vérifiée',
            'outdated' => 'Obsolète',
            'critical_structure_unverified' => 'Structure critique non vérifiée',
        ];

        $dict = $locale === 'fr' ? array_merge($en, $fr) : $en;

        return response()->json([
            'locale' => $locale,
            'fallback_locale' => 'en',
            'strings' => $dict,
        ]);
    }
}
