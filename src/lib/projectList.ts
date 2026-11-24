/** Equipment list offered in the "Nom du projet" dropdown. Format: [No., Tank Name, Client Tag]. */
export interface ProjectOption {
  no: string;
  name: string;
  tag: string;
  /** Full line "No. | Tank Name | Client Tag" (used for display / search) */
  label: string;
  /** Written into "Projet": group + client tag, e.g. "PAP-M76AAR15" */
  code: string;
  /** Written into "Designation", e.g. "Sump Tank" */
  designation: string;
}

/** "SUMP TANK" -> "Sump Tank"; short acronyms (FSA) and mixed-case names are kept. */
function niceCase(s: string): string {
  return s
    .split(' ')
    .map((w) => (w.length > 3 && w === w.toUpperCase() ? w[0] + w.slice(1).toLowerCase() : w))
    .join(' ');
}

export interface ProjectGroup {
  group: string;
  items: ProjectOption[];
}

const RAW: [string, [string, string, string][]][] = [
  [
    'PAP',
    [
      ['5555-TA01', 'GYPSUM SLURRY TANK', 'M73AAR11'],
      ['5555-TA02', 'GYPSUM SLURRY TANK', 'M73BAR11'],
      ['5555-TA03', 'GYPSUM SLURRY TANK', 'M73CAR11'],
      ['5555-TB01', 'SUMP TANK', 'M76AAR15'],
      ['5555-TB02', 'SUMP TANK', 'M76AKR15'],
      ['5555-TC01', 'Wash Water Tank', 'M76AAR06'],
      ['5555-TC02', 'Wash Water Tank', 'M76BAR06'],
      ['5555-TC03', 'Wash Water Tank', 'M76CAR06'],
      ['5555-TD01', 'WEAK CLARIFIER OVERFLOW TANK', 'M76AAR03'],
      ['5555-TD02', 'WEAK CLARIFIER OVERFLOW TANK', 'M76BAR03'],
      ['5555-TD03', 'WEAK CLARIFIER OVERFLOW TANK', 'M76CAR03'],
      ['5555-TE01', 'Product Acid Pumping Tank', 'M77AAR03'],
      ['5555-TE02', 'Product Acid Pumping Tank', 'M77BAR03'],
      ['5555-TE03', 'Product Acid Pumping Tank', 'M77CAR03'],
      ['5555-TF01', 'WEAK ACID AGING TANK', 'M76AAR01'],
      ['5555-TF02', 'WEAK ACID AGING TANK', 'M76BAR01'],
      ['5555-TF03', 'WEAK ACID AGING TANK', 'M76CAR01'],
      ['5555-TG01', 'STRONG ACID AGING TANK', 'M77AAR01'],
      ['5555-TG02', 'STRONG ACID AGING TANK', 'M77BAR01'],
      ['5555-TG03', 'STRONG ACID AGING TANK', 'M77CAR01'],
      ['5555-TH01', 'FSA PRODUCT TANK', 'M74AAR11'],
      ['5555-TH02', 'FSA PRODUCT TANK', 'M74AKR11'],
      ['5555-TI01', 'FSA Shift Tank', 'M74AAR10'],
      ['5555-TI02', 'FSA Shift Tank', 'M74ABR10'],
      ['5555-TI03', 'FSA Shift Tank', 'M74ACR10'],
      ['5555-TJ01', 'Weak Acid Clarifier', 'M76AAR02'],
      ['5555-TJ02', 'Weak Acid Clarifier', 'M76ABR02'],
      ['5555-TJ03', 'Weak Acid Clarifier', 'M76ACR02'],
      ['5555-TK01', 'Strong Acid Clarifier', 'M77AAR02'],
      ['5555-TK02', 'Strong Acid Clarifier', 'M77ABR02'],
      ['5555-TK03', 'Strong Acid Clarifier', 'M77ACR02'],
      ['5555-TL01', 'Clarifier', 'M35AAR01'],
      ['5555-TL02', 'Clarifier', 'M35ABR01'],
      ['5555-TM01', 'FSA Seal Tank', 'M74AAR06'],
      ['5555-TM02', 'FSA Seal Tank', 'M74ABR06'],
      ['5555-TM03', 'FSA Seal Tank', 'M74ACR06'],
      ['5555-TM04', 'FSA Seal Tank', 'M74ADR06'],
      ['5555-TM05', 'FSA Seal Tank', 'M74BAR06'],
      ['5555-TM06', 'FSA Seal Tank', 'M74BBR06'],
      ['5555-TM07', 'FSA Seal Tank', 'M74BCR06'],
      ['5555-TM08', 'FSA Seal Tank', 'M74BDR06'],
      ['5555-TM09', 'FSA Seal Tank', 'M74CAR06'],
      ['5555-TM10', 'FSA Seal Tank', 'M74CBR06'],
      ['5555-TM11', 'FSA Seal Tank', 'M74CCR06'],
      ['5555-TM12', 'FSA Seal Tank', 'M74CDR06'],
      ['5555-TN01', 'Weak FSA Seal Tank', 'M74AAR09'],
      ['5555-TN02', 'Weak FSA Seal Tank', 'M74ABR09'],
      ['5555-TN03', 'Weak FSA Seal Tank', 'M74ACR09'],
      ['5555-TN04', 'Weak FSA Seal Tank', 'M74ADR09'],
      ['5555-TN05', 'Weak FSA Seal Tank', 'M74BAR09'],
      ['5555-TN06', 'Weak FSA Seal Tank', 'M74BBR09'],
      ['5555-TN07', 'Weak FSA Seal Tank', 'M74BCR09'],
      ['5555-TN08', 'Weak FSA Seal Tank', 'M74BDR09'],
      ['5555-TN09', 'Weak FSA Seal Tank', 'M74CAR09'],
      ['5555-TN10', 'Weak FSA Seal Tank', 'M74CBR09'],
      ['5555-TN11', 'Weak FSA Seal Tank', 'M74CCR09'],
      ['5555-TN12', 'Weak FSA Seal Tank', 'M74CDR09'],
      ['5555-TO01', 'Neutralization Tank', 'M35AAR04'],
      ['5555-TO02', 'Neutralization Tank', 'M35BAR04'],
      ['5555-TP01', 'Clarifier overflow Tank', 'M35AAR07'],
      ['5555-TP02', 'Clarifier overflow Tank', 'M35ABR07'],
      ['5555-TQ01', 'Defoamer Tank', 'M74AAR17'],
      ['5555-TQ02', 'Defoamer Tank', 'M74ABR17'],
      ['5555-TQ03', 'Defoamer Tank', 'M74ACR17'],
      ['5555-TR01', 'Condensate Collection Tank', 'M74AAR16'],
      ['5555-TR02', 'Condensate Collection Tank', 'M74ABR16'],
      ['5555-TR03', 'Condensate Collection Tank', 'M74ACR16'],
    ],
  ],
  [
    'SMP',
    [
      ['5564-TA01', 'Sulfuric acid storage tank', 'M18AAR01'],
      ['5564-TA02', 'Sulfuric acid storage tank', 'M18AAR02'],
      ['5564-TA03', 'Sulfuric acid storage tank', 'M18AAR03'],
      ['5564-TA04', 'Sulfuric acid storage tank', 'M18AAR04'],
      ['5564-TB01', 'Sulfuric acid transfer tank', 'M18AAR05'],
      ['5564-TB02', 'Sulfuric acid transfer tank', 'M18AAR06'],
      ['5564-TB03', 'Sulfuric acid transfer tank', 'M18AAR07'],
      ['5564-TB04', 'Sulfuric acid transfer tank', 'M18AAR08'],
    ],
  ],
  ['PAT', [['5551-TC01', 'Sulfuric acid storage tank', 'M18AAR01']]],
];

export const PROJECT_GROUPS: ProjectGroup[] = RAW.map(([group, rows]) => ({
  group,
  items: rows.map(([no, name, tag]) => ({
    no,
    name,
    tag,
    label: `${no} | ${name} | ${tag}`,
    code: `${group}-${tag}`,
    designation: niceCase(name),
  })),
}));
