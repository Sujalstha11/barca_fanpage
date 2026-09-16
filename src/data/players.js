const playerImages = {
  1: '/players/1.jpg',
  2: '/players/2.jpg',
  3: '/players/3.png',
  4: '/players/4.jpg',
  5: '/players/5.jpg',
  6: '/players/6.jpg',
  7: '/players/7.png',
  8: '/players/8.jpg',
  9: '/players/9.jpg',
  10: '/players/10.jpg',
  11: '/players/11.jpg',
  12: '/players/12.jpg',
  13: '/players/13.jpg',
  14: '/players/14.jpg',
  15: '/players/15.jpg',
  16: '/players/16.png',
  17: '/players/17.jpg',
  18: '/players/18.png',
  19: '/players/19.jpg',
  20: '/players/20.jpg',
  21: '/players/21.jpg',
  22: '/players/22.jpg',
  23: '/players/23.jpg',
  24: '/players/24.jpg',
  25: '/players/25.jpg',
  26: '/players/26.jpg',
  27: '/players/27.jpg',
}

const squad = [
  { id: 1, number: 1, name: 'Joan García', shortName: 'J. García', position: 'Goalkeeper', role: 'Goalkeeper', nationality: 'Spain', flag: '🇪🇸', birthDate: '2001-05-04', joined: '2025-07-01', contractSigned: '2025-06-20', contractEnd: '2031-06-30', annualSalary: 6250000 },
  { id: 2, number: 13, name: 'Wojciech Szczęsny', shortName: 'Szczęsny', position: 'Goalkeeper', role: 'Goalkeeper', nationality: 'Poland', flag: '🇵🇱', birthDate: '1990-04-18', joined: '2024-10-02', contractSigned: '2025-07-07', contractEnd: '2027-06-30', annualSalary: 3000000 },
  { id: 3, number: 25, name: 'Dominik Livaković', shortName: 'Livaković', position: 'Goalkeeper', role: 'Goalkeeper', nationality: 'Croatia', flag: '🇭🇷', birthDate: '1995-01-09', joined: '2026-08-27', contractSigned: '2026-08-27', contractEnd: '2030-06-30', annualSalary: 4000000 },

  { id: 4, number: 2, name: 'João Cancelo', shortName: 'Cancelo', position: 'Defender', role: 'Right back', nationality: 'Portugal', flag: '🇵🇹', birthDate: '1994-05-27', joined: '2026-08-20', contractSigned: '2026-08-20', contractEnd: '2029-06-30', annualSalary: 6250000 },
  { id: 5, number: 3, name: 'Alejandro Balde', shortName: 'Balde', position: 'Defender', role: 'Left back', nationality: 'Spain', flag: '🇪🇸', birthDate: '2003-10-18', joined: '2021-07-01', contractSigned: '2023-09-21', contractEnd: '2028-06-30', annualSalary: 1670000 },
  { id: 6, number: 5, name: 'Pau Cubarsí', shortName: 'Cubarsí', position: 'Defender', role: 'Centre back', nationality: 'Spain', flag: '🇪🇸', birthDate: '2007-01-22', joined: '2024-01-01', contractSigned: '2025-02-13', contractEnd: '2029-06-30', annualSalary: 4000000 },
  { id: 7, number: 12, name: 'Xavi Espart', shortName: 'Espart', position: 'Defender', role: 'Right back', nationality: 'Spain', flag: '🇪🇸', birthDate: '2007-05-21', joined: '2026-07-01', contractSigned: '2025-08-11', contractEnd: '2028-06-30', annualSalary: null },
  { id: 8, number: 15, name: 'Andreas Christensen', shortName: 'Christensen', position: 'Defender', role: 'Centre back', nationality: 'Denmark', flag: '🇩🇰', birthDate: '1996-04-10', joined: '2022-07-01', contractSigned: '2026-07-01', contractEnd: '2028-06-30', annualSalary: 5210000 },
  { id: 9, number: 18, name: 'Gerard Martín', shortName: 'G. Martín', position: 'Defender', role: 'Left back', nationality: 'Spain', flag: '🇪🇸', birthDate: '2002-02-26', joined: '2024-07-01', contractSigned: '2025-01-24', contractEnd: '2028-06-30', annualSalary: 1560000 },
  { id: 10, number: 23, name: 'Jules Koundé', shortName: 'Koundé', position: 'Defender', role: 'Right back', nationality: 'France', flag: '🇫🇷', birthDate: '1998-11-12', joined: '2022-07-28', contractSigned: '2025-08-21', contractEnd: '2030-06-30', annualSalary: 15630000 },
  { id: 11, number: 24, name: 'Eric García', shortName: 'E. García', position: 'Defender', role: 'Centre back', nationality: 'Spain', flag: '🇪🇸', birthDate: '2001-01-09', joined: '2021-07-01', contractSigned: '2025-12-11', contractEnd: '2031-06-30', annualSalary: 8000000 },

  { id: 12, number: 4, name: 'Brian Fariñas', shortName: 'Fariñas', position: 'Midfielder', role: 'Central midfield', nationality: 'Spain', flag: '🇪🇸', birthDate: '2006-02-09', joined: '2026-07-01', contractSigned: '2025-05-14', contractEnd: '2028-06-30', annualSalary: null },
  { id: 13, number: 6, name: 'Gavi', shortName: 'Gavi', position: 'Midfielder', role: 'Central midfield', nationality: 'Spain', flag: '🇪🇸', birthDate: '2004-08-05', joined: '2021-07-01', contractSigned: '2025-01-31', contractEnd: '2030-06-30', annualSalary: 9380000 },
  { id: 14, number: 7, name: 'Fermín López', shortName: 'Fermín', position: 'Midfielder', role: 'Attacking midfield', nationality: 'Spain', flag: '🇪🇸', birthDate: '2003-05-11', joined: '2023-07-01', contractSigned: '2026-02-06', contractEnd: '2031-06-30', annualSalary: 7290000 },
  { id: 15, number: 8, name: 'Pedri', shortName: 'Pedri', position: 'Midfielder', role: 'Central midfield', nationality: 'Spain', flag: '🇪🇸', birthDate: '2002-11-25', joined: '2020-09-01', contractSigned: '2025-01-30', contractEnd: '2030-06-30', annualSalary: 12500000 },
  { id: 16, number: 16, name: 'Rodri', shortName: 'Rodri', position: 'Midfielder', role: 'Defensive midfield', nationality: 'Spain', flag: '🇪🇸', birthDate: '1996-06-22', joined: '2026-08-18', contractSigned: '2026-08-18', contractEnd: '2030-06-30', annualSalary: 27080000 },
  { id: 17, number: 20, name: 'Dani Olmo', shortName: 'D. Olmo', position: 'Midfielder', role: 'Attacking midfield', nationality: 'Spain', flag: '🇪🇸', birthDate: '1998-05-07', joined: '2024-08-09', contractSigned: '2024-08-09', contractEnd: '2030-06-30', annualSalary: 12500000 },
  { id: 18, number: 21, name: 'Frenkie de Jong', shortName: 'De Jong', position: 'Midfielder', role: 'Central midfield', nationality: 'Netherlands', flag: '🇳🇱', birthDate: '1997-05-12', joined: '2019-07-01', contractSigned: '2025-10-15', contractEnd: '2029-06-30', annualSalary: 13020000 },
  { id: 19, number: 22, name: 'Marc Bernal', shortName: 'M. Bernal', position: 'Midfielder', role: 'Defensive midfield', nationality: 'Spain', flag: '🇪🇸', birthDate: '2007-05-26', joined: '2024-07-01', contractSigned: '2025-09-29', contractEnd: '2029-06-30', annualSalary: 1250000 },

  { id: 20, number: 9, name: 'Gabriel Jesus', shortName: 'G. Jesus', position: 'Forward', role: 'Centre forward', nationality: 'Brazil', flag: '🇧🇷', birthDate: '1997-04-03', joined: '2026-09-01', contractSigned: '2026-09-01', contractEnd: '2029-06-30', annualSalary: 12000000 },
  { id: 21, number: 10, name: 'Lamine Yamal', shortName: 'Lamine', position: 'Forward', role: 'Right wing', nationality: 'Spain', flag: '🇪🇸', birthDate: '2007-07-13', joined: '2023-07-01', contractSigned: '2025-07-16', contractEnd: '2031-06-30', annualSalary: 20830000 },
  { id: 22, number: 11, name: 'Raphinha', shortName: 'Raphinha', position: 'Forward', role: 'Left wing', nationality: 'Brazil', flag: '🇧🇷', birthDate: '1996-12-14', joined: '2022-07-13', contractSigned: '2025-05-22', contractEnd: '2028-06-30', annualSalary: 16670000 },
  { id: 23, number: 14, name: 'Karim Adeyemi', shortName: 'Adeyemi', position: 'Forward', role: 'Left wing', nationality: 'Germany', flag: '🇩🇪', birthDate: '2002-01-18', joined: '2026-07-23', contractSigned: '2026-07-23', contractEnd: '2031-06-30', annualSalary: 12500000 },
  { id: 24, number: 17, name: 'Anthony Gordon', shortName: 'Gordon', position: 'Forward', role: 'Left wing', nationality: 'England', flag: '🏴', birthDate: '2001-02-24', joined: '2026-05-29', contractSigned: '2026-05-29', contractEnd: '2031-06-30', annualSalary: 12000000 },
  { id: 25, number: 19, name: 'Roony Bardghji', shortName: 'Bardghji', position: 'Forward', role: 'Right wing', nationality: 'Sweden', flag: '🇸🇪', birthDate: '2005-11-15', joined: '2025-07-14', contractSigned: '2025-07-14', contractEnd: '2029-06-30', annualSalary: 1040000 },
  { id: 26, number: 27, name: 'Jesse Bisiwu', shortName: 'Bisiwu', position: 'Forward', role: 'Right wing', nationality: 'Belgium', flag: '🇧🇪', birthDate: '2008-01-22', joined: '2026-07-31', contractSigned: '2026-07-31', contractEnd: '2031-06-30', annualSalary: 520000 },
  { id: 27, number: 29, name: 'Hamza Abdelkarim', shortName: 'Hamza', position: 'Forward', role: 'Centre forward', nationality: 'Egypt', flag: '🇪🇬', birthDate: '2008-01-01', joined: '2026-01-01', contractSigned: '2026-09-11', contractEnd: '2030-06-30', annualSalary: 780000 },
]

export const players = squad.map((player) => ({ ...player, image: playerImages[player.id] }))

export const positions = ['All', 'Goalkeeper', 'Defender', 'Midfielder', 'Forward']

export const featuredPlayerIds = [21, 15, 6]
