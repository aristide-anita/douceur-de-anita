import jsPDF from 'jspdf'
import type { Commande, CommandeItem, Recette } from './types'

/** Couleur warm-brown (#3b2a1f) en RGB pour jsPDF */
const COULEUR_WARM_BROWN: [number, number, number] = [59, 42, 31]
const COULEUR_GRIS: [number, number, number] = [120, 110, 100]
const COULEUR_DUSTY_PINK: [number, number, number] = [221, 168, 168]

interface ClientPourFacture {
  nom: string
  adresse?: string | null
  ville?: string | null
  code_postal?: string | null
  email?: string | null
  telephone?: string | null
}

interface LigneFacture {
  designation: string
  quantite: number
  prix_unitaire: number
}

interface FactureParams {
  commande: Commande
  client: ClientPourFacture | null
  items: CommandeItem[]
  /** Recettes pour résoudre les noms à partir de recette_id */
  recettes?: Pick<Recette, 'id' | 'nom'>[]
}

/** Formate un montant en CHF (ex: 12.50 → "12.50 CHF") */
function chf(n: number): string {
  return `${n.toFixed(2)} CHF`
}

/** Formate une date ISO YYYY-MM-DD → "10 juin 2026" */
function dateFR(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('fr-CH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Génère une facture PDF en mémoire et la télécharge automatiquement.
 * Format A4, en français, palette DouceurDeANITA.
 */
export function genererFacturePDF(params: FactureParams): { blob: Blob; filename: string } {
  const { commande, client, items, recettes = [] } = params
  const recetteMap = new Map(recettes.map((r) => [r.id, r.nom]))

  const lignes: LigneFacture[] = items
    .slice()
    .sort((a, b) => a.ordre - b.ordre)
    .map((it) => ({
      designation:
        it.nom_libre ||
        (it.recette_id ? recetteMap.get(it.recette_id) ?? 'Article' : 'Article'),
      quantite: it.quantite,
      prix_unitaire: it.prix_unitaire,
    }))

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margeG = 20
  const margeD = 190
  const largeur = margeD - margeG

  // ---------- En-tête : nom commercial ----------
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COULEUR_WARM_BROWN)
  doc.setFontSize(28)
  doc.text('DouceurDeANITA', margeG, 25)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...COULEUR_GRIS)
  doc.text('Pâtisserie & traiteur', margeG, 31)

  // Filet décoratif
  doc.setDrawColor(...COULEUR_DUSTY_PINK)
  doc.setLineWidth(0.8)
  doc.line(margeG, 36, margeD, 36)

  // ---------- Bloc Facture (droite) ----------
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COULEUR_WARM_BROWN)
  doc.setFontSize(16)
  doc.text('FACTURE', margeD, 25, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...COULEUR_GRIS)
  const dateEmission = new Date().toLocaleDateString('fr-CH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  if (commande.numero_commande) {
    doc.text(`N° ${commande.numero_commande}`, margeD, 31, { align: 'right' })
  }
  doc.text(`Émise le ${dateEmission}`, margeD, commande.numero_commande ? 35.5 : 31, {
    align: 'right',
  })

  // ---------- Destinataire ----------
  let y = 50
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...COULEUR_WARM_BROWN)
  doc.text('Facturé à', margeG, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...COULEUR_WARM_BROWN)

  if (client) {
    doc.text(client.nom, margeG, y)
    y += 5
    if (client.adresse) {
      doc.setFontSize(10)
      doc.setTextColor(...COULEUR_GRIS)
      doc.text(client.adresse, margeG, y)
      y += 4.5
    }
    if (client.code_postal || client.ville) {
      doc.setFontSize(10)
      doc.setTextColor(...COULEUR_GRIS)
      const cp = [client.code_postal, client.ville].filter(Boolean).join(' ')
      doc.text(cp, margeG, y)
      y += 4.5
    }
    if (client.email) {
      doc.setFontSize(10)
      doc.setTextColor(...COULEUR_GRIS)
      doc.text(client.email, margeG, y)
      y += 4.5
    }
  } else {
    doc.setFontSize(10)
    doc.setTextColor(...COULEUR_GRIS)
    doc.text('Client non renseigné', margeG, y)
    y += 5
  }

  y += 5

  // ---------- Événement ----------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...COULEUR_WARM_BROWN)
  doc.text('Date de l’événement :', margeG, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COULEUR_GRIS)
  doc.text(dateFR(commande.date_evenement), margeG + 38, y)

  if (commande.heure_evenement) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COULEUR_WARM_BROWN)
    doc.text('Heure :', margeG + 95, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COULEUR_GRIS)
    doc.text(commande.heure_evenement, margeG + 108, y)
  }
  y += 6

  if (commande.lieu_livraison) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COULEUR_WARM_BROWN)
    doc.text('Lieu :', margeG, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COULEUR_GRIS)
    doc.text(commande.lieu_livraison, margeG + 38, y, { maxWidth: largeur - 38 })
    y += 6
  }

  y += 4

  // ---------- Tableau des lignes ----------
  // En-têtes
  const colDesignation = margeG
  const colQte = margeG + 100
  const colPU = margeG + 125

  doc.setFillColor(247, 240, 230)
  doc.rect(margeG, y - 4, largeur, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...COULEUR_WARM_BROWN)
  doc.text('Désignation', colDesignation + 2, y + 1)
  doc.text('Qté', colQte + 2, y + 1, { align: 'left' })
  doc.text('Prix unitaire', colPU + 2, y + 1, { align: 'left' })
  doc.text('Total', margeD - 2, y + 1, { align: 'right' })
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...COULEUR_WARM_BROWN)

  let totalCalcule = 0
  for (const l of lignes) {
    const totalLigne = l.quantite * l.prix_unitaire
    totalCalcule += totalLigne

    // Designation peut prendre plusieurs lignes — wrap
    const desigLignes = doc.splitTextToSize(l.designation, colQte - colDesignation - 4)
    const hauteurLigne = Math.max(6, desigLignes.length * 5)

    if (y + hauteurLigne > 270) {
      doc.addPage()
      y = 25
    }

    doc.text(desigLignes, colDesignation + 2, y)
    doc.text(String(l.quantite), colQte + 2, y)
    doc.text(chf(l.prix_unitaire), colPU + 2, y)
    doc.text(chf(totalLigne), margeD - 2, y, { align: 'right' })

    y += hauteurLigne
    // Filet fin
    doc.setDrawColor(220, 210, 200)
    doc.setLineWidth(0.2)
    doc.line(margeG, y - 1, margeD, y - 1)
  }

  // ---------- Totaux ----------
  y += 6
  const totalAffiche = commande.prix_total || totalCalcule

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...COULEUR_WARM_BROWN)
  doc.text('Total', margeG + 110, y)
  doc.text(chf(totalAffiche), margeD - 2, y, { align: 'right' })
  y += 7

  if (commande.acompte_recu && commande.acompte_recu > 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...COULEUR_GRIS)
    doc.text('Acompte reçu', margeG + 110, y)
    doc.text(`- ${chf(commande.acompte_recu)}`, margeD - 2, y, { align: 'right' })
    y += 6

    const restant = totalAffiche - commande.acompte_recu
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...COULEUR_WARM_BROWN)
    doc.text('Reste à payer', margeG + 110, y)
    doc.text(chf(restant), margeD - 2, y, { align: 'right' })
    y += 8
  }

  // Note client (le cas échéant)
  if (commande.note_client) {
    y += 6
    if (y > 250) {
      doc.addPage()
      y = 25
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...COULEUR_WARM_BROWN)
    doc.text('Remarques', margeG, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COULEUR_GRIS)
    const wrap = doc.splitTextToSize(commande.note_client, largeur)
    doc.text(wrap, margeG, y)
    y += wrap.length * 4.5
  }

  // ---------- Pied de page ----------
  const piedY = 285
  doc.setDrawColor(...COULEUR_DUSTY_PINK)
  doc.setLineWidth(0.4)
  doc.line(margeG, piedY - 6, margeD, piedY - 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COULEUR_GRIS)
  doc.text('Merci pour votre confiance.', margeG, piedY)
  doc.text('DouceurDeANITA · Pâtisserie & traiteur', margeD, piedY, {
    align: 'right',
  })

  // ---------- Téléchargement ----------
  const blob = doc.output('blob')
  const numero = commande.numero_commande?.replace(/[^\w-]/g, '_') ?? commande.id.slice(0, 8)
  const filename = `Facture-${numero}.pdf`
  return { blob, filename }
}

/**
 * Déclenche le téléchargement d'un Blob avec un nom de fichier donné.
 * Compatible iOS Safari (qui restreint les téléchargements directs).
 */
export function telechargerBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Libère l'URL après un délai pour permettre le téléchargement
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Texte court résumant la facture pour partage mail / WhatsApp */
export function texteFacture(commande: Commande, client: { nom?: string } | null): string {
  const lignes: string[] = []
  lignes.push(`Bonjour${client?.nom ? ` ${client.nom}` : ''},`)
  lignes.push('')
  lignes.push(
    `Vous trouverez ci-joint votre facture${
      commande.numero_commande ? ` n° ${commande.numero_commande}` : ''
    } pour l'événement du ${dateFR(commande.date_evenement)}.`
  )
  lignes.push('')
  lignes.push(`Montant : ${chf(commande.prix_total ?? 0)}`)
  if (commande.acompte_recu && commande.acompte_recu > 0) {
    const reste = (commande.prix_total ?? 0) - commande.acompte_recu
    lignes.push(`Acompte déjà versé : ${chf(commande.acompte_recu)}`)
    lignes.push(`Reste à payer : ${chf(reste)}`)
  }
  lignes.push('')
  lignes.push('Belle journée,')
  lignes.push('Anita — DouceurDeANITA')
  return lignes.join('\n')
}
