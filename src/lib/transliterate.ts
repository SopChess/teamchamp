// Μεταγλώττιση ΕΛΟΤ 743 (ελληνικά → λατινικά, όπως στα ελληνικά διαβατήρια).
// Λατινικοί χαρακτήρες περνάνε αναλλοίωτοι (το map αγγίζει μόνο ελληνικά γράμματα),
// οπότε η ίδια function χρησιμεύει και για κανονικοποίηση πριν από συγκρίσεις/ελέγχους
// μοναδικότητας — ανεξάρτητα αν κάποιος πληκτρολόγησε ελληνικά ή λατινικά, καταλήγει
// στην ίδια μορφή.

function elot743(input: string): string {
  if (!input) return ''
  let s = input
    // αποτόνιση (κρατάμε το ίδιο γράμμα, βγάζουμε τόνο) πριν τους κανόνες διγράφων
    .replace(/ά/g,'α').replace(/έ/g,'ε').replace(/ή/g,'η').replace(/ί/g,'ι').replace(/ϊ/g,'ι').replace(/ΐ/g,'ι')
    .replace(/ό/g,'ο').replace(/ύ/g,'υ').replace(/ϋ/g,'υ').replace(/ΰ/g,'υ').replace(/ώ/g,'ω')
    .replace(/Ά/g,'Α').replace(/Έ/g,'Ε').replace(/Ή/g,'Η').replace(/Ί/g,'Ι').replace(/Ϊ/g,'Ι')
    .replace(/Ό/g,'Ο').replace(/Ύ/g,'Υ').replace(/Ϋ/g,'Υ').replace(/Ώ/g,'Ω')

  // Δίψηφα σύμφωνα (πριν τα φωνήεντα/απλά σύμφωνα, case-insensitive)
  s = s.replace(/μπ/gi, m => m[0]===m[0].toUpperCase() ? 'Mp' : 'mp')
       .replace(/ντ/gi, m => m[0]===m[0].toUpperCase() ? 'Nt' : 'nt')
       .replace(/γγ/gi, m => m[0]===m[0].toUpperCase() ? 'Ng' : 'ng')
       .replace(/γκ/gi, m => m[0]===m[0].toUpperCase() ? 'Gk' : 'gk')
       .replace(/γχ/gi, m => m[0]===m[0].toUpperCase() ? 'Nch' : 'nch')
       .replace(/γξ/gi, m => m[0]===m[0].toUpperCase() ? 'Nx' : 'nx')

  // Δίφθογγοι αυ/ευ: af/av, ef/ev ανάλογα με το επόμενο γράμμα
  s = s.replace(/([αΑ])([υΥ])(?=[θκξπστφχψΘΚΞΠΣΤΦΧΨ]|$)/g, (_,a) => (a==='Α'?'AF':'af'))
       .replace(/([αΑ])([υΥ])/g, (_,a) => (a==='Α'?'AV':'av'))
       .replace(/([εΕ])([υΥ])(?=[θκξπστφχψΘΚΞΠΣΤΦΧΨ]|$)/g, (_,e) => (e==='Ε'?'EF':'ef'))
       .replace(/([εΕ])([υΥ])/g, (_,e) => (e==='Ε'?'EV':'ev'))

  // Λοιποί δίφθογγοι
  s = s.replace(/αι/g,'ai').replace(/Αι/g,'Ai').replace(/ΑΙ/g,'AI')
       .replace(/ει/g,'ei').replace(/Ει/g,'Ei').replace(/ΕΙ/g,'EI')
       .replace(/οι/g,'oi').replace(/Οι/g,'Oi').replace(/ΟΙ/g,'OI')
       .replace(/ου/g,'ou').replace(/Ου/g,'Ou').replace(/ΟΥ/g,'OU')

  const map: Record<string,string> = {
    'α':'a','β':'v','γ':'g','δ':'d','ε':'e','ζ':'z','η':'i','θ':'th','ι':'i','κ':'k',
    'λ':'l','μ':'m','ν':'n','ξ':'x','ο':'o','π':'p','ρ':'r','σ':'s','ς':'s','τ':'t',
    'υ':'y','φ':'f','χ':'ch','ψ':'ps','ω':'o',
    'Α':'A','Β':'V','Γ':'G','Δ':'D','Ε':'E','Ζ':'Z','Η':'I','Θ':'TH','Ι':'I','Κ':'K',
    'Λ':'L','Μ':'M','Ν':'N','Ξ':'X','Ο':'O','Π':'P','Ρ':'R','Σ':'S','Τ':'T',
    'Υ':'Y','Φ':'F','Χ':'CH','Ψ':'PS','Ω':'O'
  }
  return s.split('').map(ch => map[ch] !== undefined ? map[ch] : ch).join('')
}

// Κανονικοποιημένη μορφή για συγκρίσεις μοναδικότητας: πάντα λατινικά (ΕΛΟΤ 743),
// uppercase, χωρίς κενά στην αρχή/τέλος — ανεξάρτητα από το αλφάβητο εισαγωγής.
export function normalizeName(input: string): string {
  return elot743((input||'').trim()).toUpperCase()
}

// Σωστή μετατροπή ελληνικού κειμένου σε ΚΕΦΑΛΑΙΑ: αφαιρεί τόνο/διαλυτικά πριν κεφαλαιοποιήσει
// (π.χ. "Λευκά" → "ΛΕΥΚΑ", ΟΧΙ "ΛΕΥΚΆ"). Χρειάζεται γιατί το CSS text-transform:uppercase
// ΔΕΝ αφαιρεί τον τόνο σε Chrome/Safari (μόνο το Firefox το κάνει σωστά αυτόματα) — οπότε
// όπου θέλουμε ελληνικό κείμενο σε κεφαλαία, καλύτερα να γράφεται ήδη έτσι στο κείμενο,
// αντί να βασιζόμαστε στο CSS.
export function toGreekUpperCase(input: string): string {
  if (!input) return input
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
}

// Καθαρισμός ονόματος/επωνύμου πριν αποθήκευση: κόβει κενά στην αρχή/τέλος και μαζεύει
// τυχόν διπλά/πολλαπλά κενά ΣΤΗ ΜΕΣΗ σε ένα — ποτέ δεν πειράζει το μοναδικό κενό ανάμεσα
// σε σύνθετα ονόματα/επώνυμα (π.χ. "ΝΙΚΟΛΑΟΣ ΡΗΓΑΣ", "ΜΑΥΡΟΜΜΑΤΗΣ ΚΕΣΙΔΗΣ" μένουν ίδια).
// Χρειάζεται γιατί αόρατα κενά στην άκρη/μέση έσπαγαν το αυτόματο ταίριασμα ονομάτων
// Swiss-Manager (βλ. swissNameMatching.ts).
export function cleanName(input: string): string {
  return (input || '').trim().replace(/\s+/g, ' ')
}

export { elot743 }
