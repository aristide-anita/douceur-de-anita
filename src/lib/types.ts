// TypeScript types matching the Supabase schema (Sprint0 DDL).
// Kept hand-written. Can later be replaced with `supabase gen types typescript`.

// ---------- ENUMs ----------

export type StatutCommande =
  | 'brouillon'
  | 'confirmee'
  | 'en_preparation'
  | 'prete'
  | 'livree'
  | 'annulee'

export type StatutPaiement = 'impaye' | 'acompte' | 'paye'

export type CategorieRecette =
  | 'patisserie'
  | 'traiteur_salee'
  | 'traiteur_sucree'
  | 'boisson'
  | 'autre'

export type UniteIngredient =
  | 'g'
  | 'kg'
  | 'ml'
  | 'l'
  | 'piece'
  | 'cuillere'
  | 'pincee'

export type CategorieDepense =
  | 'matieres_premieres'
  | 'emballage'
  | 'materiel'
  | 'marketing'
  | 'deplacement'
  | 'abonnement'
  | 'autre'

export type RoleUtilisateur =
  | 'patronne'
  | 'assistant'
  | 'comptable'
  | 'lecture_seule'

// ---------- Profile ----------

export interface Profile {
  id: string
  email: string
  nom_complet: string | null
  role: RoleUtilisateur
  tarif_horaire_chf: number
  cree_le: string
  modifie_le: string
}

// ---------- Client ----------

export interface Client {
  id: string
  nom: string
  telephone: string | null
  email: string | null
  adresse: string | null
  ville: string | null
  code_postal: string | null
  note: string | null
  cree_par: string | null
  cree_le: string
  modifie_le: string
}

// ---------- Fournisseur ----------

export interface Fournisseur {
  id: string
  nom: string
  type: string | null
  telephone: string | null
  email: string | null
  adresse: string | null
  site_web: string | null
  note: string | null
  actif: boolean
  cree_par: string | null
  cree_le: string
  modifie_le: string
}

// ---------- Recette ----------

export interface Recette {
  id: string
  nom: string
  categorie: CategorieRecette
  description: string | null
  photo_url: string | null
  portions: number
  temps_prepa_min: number
  cout_matieres_forfait: number
  cout_emballage: number
  prix_vente: number
  actif: boolean
  favori: boolean
  cree_par: string | null
  cree_le: string
  modifie_le: string
}

// ---------- Commande ----------

export interface Commande {
  id: string
  numero_commande: string | null
  client_id: string | null
  date_evenement: string
  heure_evenement: string | null
  lieu_livraison: string | null
  statut: StatutCommande
  statut_paiement: StatutPaiement
  prix_total: number
  acompte_recu: number
  note_interne: string | null
  note_client: string | null
  cree_par: string | null
  cree_le: string
  modifie_le: string
}

export interface CommandeAvecClient extends Commande {
  client: Pick<Client, 'id' | 'nom' | 'telephone'> | null
}

export interface CommandeItem {
  id: string
  commande_id: string
  recette_id: string | null
  nom_libre: string | null
  quantite: number
  prix_unitaire: number
  note: string | null
  ordre: number
  cree_le: string
}

// ---------- Finance ----------

export interface Finance {
  id: string
  date_depense: string
  libelle: string
  montant_chf: number
  categorie: CategorieDepense
  fournisseur_id: string | null
  commande_id: string | null
  recu_url: string | null
  note: string | null
  cree_par: string | null
  cree_le: string
  modifie_le: string
}

// ---------- Ingredient ----------

export interface Ingredient {
  id: string
  nom: string
  unite_achat: UniteIngredient
  prix_unitaire_chf: number
  fournisseur_principal_id: string | null
  stock_actuel: number
  stock_minimum: number
  note: string | null
  actif: boolean
  cree_par: string | null
  cree_le: string
  modifie_le: string
}

// ---------- Labels d'UI ----------

export const STATUT_COMMANDE_LABELS: Record<StatutCommande, string> = {
  brouillon: 'Brouillon',
  confirmee: 'Confirmée',
  en_preparation: 'En préparation',
  prete: 'Prête',
  livree: 'Livrée',
  annulee: 'Annulée',
}

export const STATUT_PAIEMENT_LABELS: Record<StatutPaiement, string> = {
  impaye: 'Impayé',
  acompte: 'Acompte reçu',
  paye: 'Payé',
}

export const STATUT_COMMANDE_ORDRE: StatutCommande[] = [
  'brouillon',
  'confirmee',
  'en_preparation',
  'prete',
  'livree',
  'annulee',
]
