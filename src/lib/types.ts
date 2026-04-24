// TypeScript types matching the Supabase schema.
// These are kept hand-written (can later be regenerated with `supabase gen types`).

// ---------- ENUMs ----------

export type StatutCommande =
  | 'brouillon'
  | 'confirmee'
  | 'en_preparation'
  | 'prete'
  | 'livree'
  | 'annulee'

export type StatutPaiement = 'impaye' | 'partiel' | 'paye' | 'rembourse'

export type TypeCommande = 'patisserie' | 'traiteur' | 'mixte'

export type ModePaiement =
  | 'especes'
  | 'twint'
  | 'virement'
  | 'carte'
  | 'facture'

export type UniteIngredient =
  | 'g'
  | 'kg'
  | 'ml'
  | 'l'
  | 'piece'
  | 'cuillere_cafe'
  | 'cuillere_soupe'

export type TypeDepense =
  | 'ingredients'
  | 'emballage'
  | 'materiel'
  | 'transport'
  | 'loyer'
  | 'marketing'
  | 'autre'

export type RoleUtilisateur = 'proprietaire' | 'employe' | 'assistant'

// ---------- Profile ----------

export interface Profile {
  id: string
  email: string
  prenom: string | null
  nom: string | null
  telephone: string | null
  role: RoleUtilisateur
  avatar_url: string | null
  created_at: string
  updated_at: string
}

// ---------- Client ----------

export interface Client {
  id: string
  user_id: string
  prenom: string
  nom: string | null
  email: string | null
  telephone: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  notes: string | null
  allergies: string | null
  date_anniversaire: string | null // ISO date
  created_at: string
  updated_at: string
}

// ---------- Fournisseur ----------

export interface Fournisseur {
  id: string
  user_id: string
  nom: string
  contact: string | null
  email: string | null
  telephone: string | null
  adresse: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ---------- Ingredient ----------

export interface Ingredient {
  id: string
  user_id: string
  nom: string
  unite: UniteIngredient
  prix_unitaire: number | null // CHF par unité
  stock_actuel: number | null
  stock_minimum: number | null
  fournisseur_id: string | null
  allergene: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

// ---------- Recette ----------

export interface Recette {
  id: string
  user_id: string
  nom: string
  description: string | null
  categorie: string | null
  portions: number | null
  temps_preparation_min: number | null
  temps_cuisson_min: number | null
  instructions: string | null
  prix_vente: number | null // CHF
  cout_revient: number | null // CHF calculé
  image_url: string | null
  actif: boolean
  created_at: string
  updated_at: string
}

export interface RecetteIngredient {
  id: string
  recette_id: string
  ingredient_id: string
  quantite: number
  unite: UniteIngredient
}

// ---------- Commande ----------

export interface Commande {
  id: string
  user_id: string
  numero: string
  client_id: string | null
  type: TypeCommande
  statut: StatutCommande
  statut_paiement: StatutPaiement
  mode_paiement: ModePaiement | null
  date_commande: string // ISO
  date_livraison: string // ISO
  heure_livraison: string | null
  adresse_livraison: string | null
  nombre_personnes: number | null
  sous_total: number
  tva: number
  total: number
  acompte: number
  reste_a_payer: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CommandeLigne {
  id: string
  commande_id: string
  recette_id: string | null
  libelle: string
  quantite: number
  prix_unitaire: number
  total: number
}

// ---------- Finance ----------

export interface Finance {
  id: string
  user_id: string
  date: string // ISO date
  type: TypeDepense
  libelle: string
  montant: number // CHF
  fournisseur_id: string | null
  commande_id: string | null
  mode_paiement: ModePaiement | null
  justificatif_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}
