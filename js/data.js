/* ============================================================
   RANKED — Static catalog + mock data
   ============================================================ */

window.DATA = (function () {

  /* ─── Categories ─── */
  const CATEGORIES = [
    { id: 'finanzen', label: 'Finanzen',  icon: '€', tagline: 'Geld, Investments, Business' },
    { id: 'fitness',  label: 'Fitness',   icon: '◐', tagline: 'Kraft, Ausdauer, Form' },
    { id: 'skills',   label: 'Skills',    icon: '◇', tagline: 'Wissen, Output, Reichweite' },
    { id: 'streaks',  label: 'Streaks',   icon: '↻', tagline: 'Dranbleiben über Wochen' },
    { id: 'social',   label: 'Social',    icon: '◍', tagline: 'Reichweite, Verbindungen, Impact' },
    { id: 'travel',   label: 'Reisen',    icon: '✈', tagline: 'Länder, Kontinente, Trips' },
    { id: 'mind',     label: 'Mindset',   icon: '✦', tagline: 'Disziplin, Wissen, Klarheit' },
  ];

  /* ─── Achievement Catalog ─── */
  const ACHIEVEMENTS = [
    // Finanzen
    { id: 'fin.first',         cat: 'finanzen', title: 'Erstes eigenes Geld verdient',  sub: 'Egal wie klein. Es zählt.',                points: 50 },
    { id: 'fin.save.1k',       cat: 'finanzen', title: '€1.000 gespart',                sub: 'Sichtbar auf dem Konto.',                  points: 200 },
    { id: 'fin.save.5k',       cat: 'finanzen', title: '€5.000 gespart',                sub: 'Erstes echtes Polster.',                   points: 500 },
    { id: 'fin.save.10k',      cat: 'finanzen', title: '€10.000 gespart',               sub: 'Notgroschen steht.',                       points: 1200 },
    { id: 'fin.invest.first',  cat: 'finanzen', title: 'Erste Aktie / ETF gekauft',     sub: 'Egal wie viel.',                           points: 150 },
    { id: 'fin.invest.10k',    cat: 'finanzen', title: '€10.000 in Investments',        sub: 'Aktien, ETFs, Crypto kombiniert.',         points: 1000 },
    { id: 'fin.invest.50k',    cat: 'finanzen', title: '€50.000 in Investments',        sub: 'Sechsstellig im Sicht.',                   points: 3500 },
    { id: 'fin.selbst',        cat: 'finanzen', title: 'Selbständig angemeldet',        sub: 'Gewerbe oder Freelance.',                  points: 500 },
    { id: 'fin.car.first',     cat: 'finanzen', title: 'Erstes Auto selbst gekauft',    sub: 'Vom eigenen Geld.',                        points: 1000 },
    { id: 'fin.car.dream',     cat: 'finanzen', title: 'Traum-Auto gekauft',            sub: 'M3, RS, GT3 — die Liga.',                  points: 5000 },
    { id: 'fin.side.100',      cat: 'finanzen', title: 'Side-Hustle €100/Monat',        sub: 'Wiederkehrend, nicht einmalig.',           points: 300 },
    { id: 'fin.side.500',      cat: 'finanzen', title: 'Side-Hustle €500/Monat',        sub: 'Wiederkehrend.',                           points: 700 },
    { id: 'fin.side.1k',       cat: 'finanzen', title: 'Side-Hustle €1.000/Monat',      sub: 'Erste echte Schwelle.',                    points: 1500 },
    { id: 'fin.side.5k',       cat: 'finanzen', title: 'Side-Hustle €5.000/Monat',      sub: 'Vollzeit-Ersatz möglich.',                 points: 4000 },
    { id: 'fin.side.10k',      cat: 'finanzen', title: 'Side-Hustle €10.000/Monat',     sub: '€120k Run-Rate.',                          points: 8000 },
    { id: 'fin.year.6fig',     cat: 'finanzen', title: 'Erstes 6-stelliges Jahr',       sub: '€100.000 in einem Kalenderjahr.',          points: 10000 },

    // Fitness
    { id: 'fit.consistent',    cat: 'fitness',  title: '1 Monat 3x/Woche Gym',          sub: 'Ohne Lücke.',                              points: 200 },
    { id: 'fit.bench.60',      cat: 'fitness',  title: 'Bench Press 60 kg',             sub: 'Ein sauberer Rep.',                        points: 200 },
    { id: 'fit.bench.80',      cat: 'fitness',  title: 'Bench Press 80 kg',             sub: 'Ein sauberer Rep.',                        points: 400 },
    { id: 'fit.bench.100',     cat: 'fitness',  title: 'Bench Press 100 kg',            sub: 'Ein sauberer Rep.',                        points: 700 },
    { id: 'fit.bench.120',     cat: 'fitness',  title: 'Bench Press 120 kg',            sub: 'Ein sauberer Rep.',                        points: 1200 },
    { id: 'fit.bench.140',     cat: 'fitness',  title: 'Bench Press 140 kg',            sub: 'Ein sauberer Rep.',                        points: 2000 },
    { id: 'fit.squat.100',     cat: 'fitness',  title: 'Squat 100 kg',                  sub: 'Tief und sauber.',                         points: 300 },
    { id: 'fit.squat.140',     cat: 'fitness',  title: 'Squat 140 kg',                  sub: 'Tief und sauber.',                         points: 600 },
    { id: 'fit.squat.180',     cat: 'fitness',  title: 'Squat 180 kg',                  sub: 'Tief und sauber.',                         points: 1000 },
    { id: 'fit.dead.180',      cat: 'fitness',  title: 'Deadlift 180 kg',               sub: 'Sauber, ohne Reverse-Hyper.',              points: 800 },
    { id: 'fit.run.5k.25',     cat: 'fitness',  title: '5 km unter 25 Minuten',         sub: 'Saubere Strecke.',                         points: 300 },
    { id: 'fit.run.5k.22',     cat: 'fitness',  title: '5 km unter 22 Minuten',         sub: 'Saubere Strecke.',                         points: 600 },
    { id: 'fit.run.5k.20',     cat: 'fitness',  title: '5 km unter 20 Minuten',         sub: 'Sub-4-Minuten-Pace.',                      points: 1000 },
    { id: 'fit.run.10k',       cat: 'fitness',  title: '10 km am Stück gelaufen',       sub: 'Egal wie schnell.',                        points: 400 },
    { id: 'fit.run.half',      cat: 'fitness',  title: 'Halbmarathon abgeschlossen',    sub: '21,1 km.',                                 points: 1000 },
    { id: 'fit.run.marathon',  cat: 'fitness',  title: 'Marathon abgeschlossen',        sub: '42,2 km.',                                 points: 2000 },
    { id: 'fit.body.15',       cat: 'fitness',  title: 'Körperfett unter 15 %',         sub: 'Sichtbare Definition.',                    points: 700 },
    { id: 'fit.body.10',       cat: 'fitness',  title: 'Körperfett unter 10 %',         sub: 'Stage-Lean.',                              points: 1500 },

    // Skills
    { id: 'skl.book.1',        cat: 'skills',   title: 'Erstes Sachbuch durchgelesen',  sub: 'Cover bis Cover.',                         points: 50 },
    { id: 'skl.book.10',       cat: 'skills',   title: '10 Bücher gelesen',             sub: 'Aufgezählt, mit Notizen.',                 points: 500 },
    { id: 'skl.book.50',       cat: 'skills',   title: '50 Bücher gelesen',             sub: 'Aufgezählt, mit Notizen.',                 points: 2000 },
    { id: 'skl.lang',          cat: 'skills',   title: 'Programmiersprache gelernt',    sub: 'Etwas Verkaufbares damit gebaut.',         points: 300 },
    { id: 'skl.proj.live',     cat: 'skills',   title: 'Side-Projekt online',           sub: 'Live im Internet, eigene Domain.',         points: 500 },
    { id: 'skl.client',        cat: 'skills',   title: 'Erster zahlender Kunde',        sub: 'Wirklich überwiesen.',                     points: 800 },
    { id: 'skl.client.10',     cat: 'skills',   title: '10 zahlende Kunden',            sub: 'Echtes Business.',                         points: 2500 },
    { id: 'skl.cert',          cat: 'skills',   title: 'Zertifikat erworben',           sub: 'Anerkannte Stelle.',                       points: 300 },
    { id: 'skl.web',           cat: 'skills',   title: 'Eigene Website live',           sub: 'Selbst gebaut.',                           points: 200 },
    { id: 'skl.talk',          cat: 'skills',   title: 'Vortrag gehalten',              sub: 'Vor min. 20 Leuten.',                      points: 400 },
    { id: 'skl.book.write',    cat: 'skills',   title: 'Buch geschrieben',              sub: 'Veröffentlicht.',                          points: 3000 },

    // Streaks
    { id: 'str.gym.7',         cat: 'streaks',  title: '7 Tage Gym-Streak',             sub: 'Jeden Tag.',                               points: 100 },
    { id: 'str.gym.30',        cat: 'streaks',  title: '30 Tage Gym-Streak',            sub: 'Jeden Tag.',                               points: 500 },
    { id: 'str.gym.100',       cat: 'streaks',  title: '100 Tage Gym-Streak',           sub: 'Jeden Tag.',                               points: 2000 },
    { id: 'str.read.7',        cat: 'streaks',  title: '7 Tage Lese-Streak',            sub: 'Min. 20 Min/Tag.',                         points: 100 },
    { id: 'str.read.30',       cat: 'streaks',  title: '30 Tage Lese-Streak',           sub: 'Min. 20 Min/Tag.',                         points: 500 },
    { id: 'str.sugar',         cat: 'streaks',  title: '30 Tage No-Sugar',              sub: 'Kein Industriezucker.',                    points: 300 },
    { id: 'str.cold',          cat: 'streaks',  title: '90 Tage Cold-Showers',          sub: '<15°C, min. 2 Min.',                       points: 500 },
    { id: 'str.no.alcohol.30', cat: 'streaks',  title: '30 Tage No-Alcohol',            sub: 'Komplett dry.',                            points: 300 },
    { id: 'str.meditation.30', cat: 'streaks',  title: '30 Tage Meditation',            sub: 'Min. 10 Min/Tag.',                          points: 300 },
    { id: 'str.no.phone.7',    cat: 'streaks',  title: '7 Tage No-Social-Media',        sub: 'Insta, TikTok, X komplett aus.',           points: 400 },
    { id: 'str.no.fastfood',   cat: 'streaks',  title: '60 Tage No-Fastfood',           sub: 'McDoof, Burger King, KFC dry.',            points: 500 },

    // Social — Reichweite, Verbindungen, Impact
    { id: 'soc.followers.1k',  cat: 'social',   title: '1.000 Follower (eine Plattform)', sub: 'Insta, TikTok, X — wo auch immer.',     points: 400 },
    { id: 'soc.followers.10k', cat: 'social',   title: '10.000 Follower',                 sub: 'Echte Reichweite.',                       points: 1500 },
    { id: 'soc.followers.100k',cat: 'social',   title: '100.000 Follower',                sub: 'Influencer-Status.',                       points: 6000 },
    { id: 'soc.viral.video',   cat: 'social',   title: 'Viraler Post (1M+ Views)',        sub: 'Egal welches Format.',                    points: 2500 },
    { id: 'soc.podcast',       cat: 'social',   title: 'Podcast gestartet',               sub: 'Min. 5 Folgen veröffentlicht.',           points: 600 },
    { id: 'soc.youtube.start', cat: 'social',   title: 'YouTube-Kanal gestartet',         sub: 'Min. 10 Videos.',                          points: 500 },
    { id: 'soc.network.event', cat: 'social',   title: 'Networking-Event veranstaltet',   sub: 'Min. 20 Teilnehmer.',                     points: 800 },
    { id: 'soc.mentor',        cat: 'social',   title: 'Jemanden gementored',             sub: 'Über 3+ Monate.',                          points: 600 },
    { id: 'soc.charity',       cat: 'social',   title: 'Spende über €500',                sub: 'An anerkannte Org.',                       points: 400 },
    { id: 'soc.team.lead',     cat: 'social',   title: 'Team geführt',                    sub: 'Min. 3 Personen, 6+ Monate.',              points: 1200 },

    // Travel — Länder, Kontinente, Trips
    { id: 'tra.country.5',     cat: 'travel',   title: '5 Länder besucht',                sub: 'Mit Stempel oder Foto-Beweis.',            points: 300 },
    { id: 'tra.country.10',    cat: 'travel',   title: '10 Länder besucht',               sub: '',                                          points: 700 },
    { id: 'tra.country.25',    cat: 'travel',   title: '25 Länder besucht',               sub: 'Beneidet von allen.',                      points: 2000 },
    { id: 'tra.continents.3',  cat: 'travel',   title: '3 Kontinente besucht',            sub: '',                                          points: 600 },
    { id: 'tra.continents.5',  cat: 'travel',   title: '5 Kontinente besucht',            sub: 'Echter World-Traveler.',                  points: 2500 },
    { id: 'tra.solo',          cat: 'travel',   title: 'Solo-Trip 14+ Tage',              sub: 'Allein gereist, nicht mit Group.',         points: 500 },
    { id: 'tra.workation',     cat: 'travel',   title: 'Workation 30+ Tage',              sub: 'Remote von einem anderen Land.',           points: 800 },
    { id: 'tra.business',      cat: 'travel',   title: 'Business Class geflogen',         sub: 'Selbst bezahlt, nicht von Firma.',         points: 700 },

    // Mindset — Disziplin, Wissen, Klarheit
    { id: 'mnd.therapy',       cat: 'mind',     title: 'Therapie / Coaching gestartet',  sub: 'Aktiv investiert in dich selbst.',         points: 400 },
    { id: 'mnd.no.weed',       cat: 'mind',     title: '90 Tage No-Weed',                 sub: 'Komplett clean.',                          points: 600 },
    { id: 'mnd.journal.30',    cat: 'mind',     title: '30 Tage Journal-Streak',          sub: 'Tägliches Reflektieren.',                  points: 300 },
    { id: 'mnd.silence',       cat: 'mind',     title: 'Silent Retreat absolviert',       sub: 'Min. 3 Tage Schweigen.',                   points: 800 },
    { id: 'mnd.fasting.16',    cat: 'mind',     title: '16/8 Fasten 30 Tage',             sub: 'Intermittent Fasting Streak.',             points: 400 },
    { id: 'mnd.cold.exposure', cat: 'mind',     title: 'Eisbad / Wim Hof gemeistert',     sub: 'Min. 3 Min unter 5°C.',                    points: 500 },
    { id: 'mnd.fight.fear',    cat: 'mind',     title: 'Größte Angst überwunden',         sub: 'Selbst beurteilt, von Freunden bestätigt.', points: 1000 },
  ];

  /* ─── Avatar color palette (deterministic by name) ─── */
  const AVATAR_COLORS = [
    { bg: '#1E40FF', fg: '#FFFFFF' }, // cobalt
    { bg: '#7C3AED', fg: '#FFFFFF' }, // violet
    { bg: '#0EA5E9', fg: '#FFFFFF' }, // sky
    { bg: '#10B981', fg: '#FFFFFF' }, // emerald
    { bg: '#F59E0B', fg: '#0A0A0A' }, // amber
    { bg: '#E11D48', fg: '#FFFFFF' }, // rose
    { bg: '#0F172A', fg: '#FFFFFF' }, // slate-deep
    { bg: '#475569', fg: '#FFFFFF' }, // slate
    { bg: '#7E22CE', fg: '#FFFFFF' }, // purple
    { bg: '#0891B2', fg: '#FFFFFF' }, // teal
  ];
  function avatarColor(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }

  /* ─── Mock Friends ─── */
  const FRIENDS = [
    {
      id: 'f.marc', name: 'Marc Köhler', city: 'Wiesbaden',
      cityRank: 14,
      categoryPoints: { finanzen: 4400, fitness: 2200, skills: 1300, streaks: 600 },
      score: 8500,
      achievements: [
        { id: 'fin.side.5k', date: '2026-04-29', verified: true, cityVerified: true },
        { id: 'fin.invest.10k', date: '2026-02-04', verified: true, cityVerified: true },
        { id: 'fit.bench.100', date: '2026-04-30', verified: true, cityVerified: true },
        { id: 'fit.run.half', date: '2026-01-22', verified: true, cityVerified: true },
        { id: 'skl.client', date: '2025-11-30', verified: true, cityVerified: true },
        { id: 'str.gym.30', date: '2026-04-02', verified: true, cityVerified: true },
      ],
      trophies: [
        { cat: 'auto', label: 'BMW M340i xDrive', detail: '2024, Tanzanit Blue' },
        { cat: 'watch', label: 'Tudor Black Bay 58', detail: '2023' },
        { cat: 'invest', label: 'Portfolio €34.000', detail: 'ETF + Einzelaktien' },
      ],
    },
    {
      id: 'f.yusuf', name: 'Yusuf Demir', city: 'Wiesbaden',
      cityRank: 27,
      categoryPoints: { finanzen: 1800, fitness: 1700, skills: 700, streaks: 0 },
      score: 4200,
      achievements: [
        { id: 'fin.side.1k', date: '2026-05-01', verified: true, cityVerified: true },
        { id: 'fin.car.first', date: '2025-09-14', verified: true, cityVerified: true },
        { id: 'fit.bench.100', date: '2026-04-08', verified: true, cityVerified: true },
        { id: 'fit.body.15', date: '2026-02-19', verified: true, cityVerified: true },
        { id: 'skl.proj.live', date: '2026-01-11', verified: true, cityVerified: true },
      ],
      trophies: [
        { cat: 'auto', label: 'Audi A4 B9', detail: '2019, Mythosschwarz' },
        { cat: 'invest', label: 'Portfolio €8.500', detail: 'ETF-Sparplan' },
      ],
    },
    {
      id: 'f.tim', name: 'Tim Weber', city: 'Wiesbaden',
      cityRank: 36,
      categoryPoints: { finanzen: 1700, fitness: 2300, skills: 700, streaks: 500 },
      score: 5200,
      achievements: [
        { id: 'fin.side.500', date: '2026-04-01', verified: true, cityVerified: true },
        { id: 'fin.save.5k', date: '2026-03-04', verified: true, cityVerified: true },
        { id: 'fit.bench.100', date: '2026-04-22', verified: true, cityVerified: true },
        { id: 'fit.squat.140', date: '2026-04-10', verified: true, cityVerified: true },
        { id: 'fit.run.10k', date: '2026-02-08', verified: true, cityVerified: true },
        { id: 'skl.lang', date: '2026-01-30', verified: true, cityVerified: true },
        { id: 'str.gym.30', date: '2026-04-25', verified: true, cityVerified: true },
      ],
      trophies: [
        { cat: 'auto', label: 'VW Golf 8 GTI', detail: '2022' },
        { cat: 'watch', label: 'Seiko Prospex', detail: '2023' },
      ],
    },
    {
      id: 'f.leo', name: 'Leo Vasiliou', city: 'Wiesbaden',
      cityRank: 51,
      categoryPoints: { finanzen: 1300, fitness: 1900, skills: 600, streaks: 0 },
      score: 3800,
      achievements: [
        { id: 'fin.side.500', date: '2026-04-12', verified: true, cityVerified: true },
        { id: 'fit.bench.80', date: '2026-03-20', verified: true, cityVerified: true },
        { id: 'fit.squat.100', date: '2026-02-12', verified: true, cityVerified: true },
        { id: 'fit.run.5k.22', date: '2026-04-02', verified: true, cityVerified: true },
        { id: 'skl.proj.live', date: '2026-01-25', verified: true, cityVerified: true },
      ],
      trophies: [
        { cat: 'auto', label: 'BMW 3er F30', detail: '2018' },
      ],
    },
    {
      id: 'f.jonas', name: 'Jonas Müller', city: 'Wiesbaden',
      cityRank: 73,
      categoryPoints: { finanzen: 800, fitness: 700, skills: 600, streaks: 0 },
      score: 2100,
      achievements: [
        { id: 'fin.invest.first', date: '2026-04-04', verified: true, cityVerified: true },
        { id: 'fin.save.1k', date: '2026-03-15', verified: true, cityVerified: true },
        { id: 'fit.bench.80', date: '2026-04-09', verified: true, cityVerified: true },
        { id: 'skl.proj.live', date: '2026-02-22', verified: true, cityVerified: true },
      ],
      trophies: [],
    },
    {
      id: 'f.niko', name: 'Niko Petrov', city: 'Wiesbaden',
      cityRank: 89,
      categoryPoints: { finanzen: 350, fitness: 700, skills: 450, streaks: 0 },
      score: 1500,
      achievements: [
        { id: 'fin.first', date: '2026-04-19', verified: true, cityVerified: true },
        { id: 'fin.save.1k', date: '2026-04-23', verified: true, cityVerified: true },
        { id: 'fit.bench.60', date: '2026-04-15', verified: true, cityVerified: true },
        { id: 'fit.squat.100', date: '2026-04-25', verified: true, cityVerified: true },
        { id: 'skl.lang', date: '2026-03-08', verified: true, cityVerified: true },
      ],
      trophies: [],
    },
    {
      id: 'f.sebi', name: 'Sebastian Wagner', city: 'Wiesbaden',
      cityRank: 96,
      categoryPoints: { finanzen: 200, fitness: 350, skills: 200, streaks: 100 },
      score: 850,
      achievements: [
        { id: 'fin.first', date: '2026-04-22', verified: true, cityVerified: true },
        { id: 'fit.consistent', date: '2026-04-01', verified: true, cityVerified: true },
        { id: 'fit.bench.60', date: '2026-04-20', verified: true, cityVerified: true },
        { id: 'skl.web', date: '2026-04-12', verified: true, cityVerified: true },
        { id: 'str.gym.7', date: '2026-04-30', verified: true, cityVerified: true },
      ],
      trophies: [],
    },
  ];

  /* ─── Search-Pool: more potential friends to add ─── */
  const SEARCH_POOL = [
    { id: 's.alex',  name: 'Alex Berger',     city: 'Wiesbaden', score: 1200 },
    { id: 's.lena',  name: 'Lena Hoffmann',   city: 'Frankfurt', score: 3400 },
    { id: 's.chris', name: 'Chris Bauer',     city: 'Wiesbaden', score: 2800 },
    { id: 's.kerem', name: 'Kerem Yılmaz',    city: 'Wiesbaden', score: 5400 },
    { id: 's.julian',name: 'Julian Frank',    city: 'Mainz',     score: 990 },
    { id: 's.philipp',name:'Philipp Schmitt', city: 'Wiesbaden', score: 1850 },
    { id: 's.dominik',name:'Dominik Krüger',  city: 'Wiesbaden', score: 720 },
    { id: 's.mert',  name: 'Mert Kaya',       city: 'Frankfurt', score: 4100 },
    { id: 's.luca',  name: 'Luca Romano',     city: 'Wiesbaden', score: 1450 },
    { id: 's.fynn',  name: 'Fynn Werner',     city: 'Wiesbaden', score: 2200 },
  ];

  /* ─── Wiesbaden Top-100 (anonym + glaubwürdig) ─── */
  const FIRST_NAMES = [
    'Lukas','Felix','Maximilian','Tobias','Jonas','David','Niklas','Paul','Leon','Tim',
    'Yusuf','Burak','Murat','Selim','Emre','Mehmet','Can','Ali','Hassan','Omar',
    'Marco','Marc','Dennis','Sven','Florian','Manuel','Christopher','Alexander','Jan','Philipp',
    'Nicolas','Andreas','Sebastian','Robin','Max','Linus','Erik','Henry','Luis','Theo',
    'Nikolas','Dimitri','Pavel','Alex','Daniel','Thomas','Stefan','Kevin','Patrick','Julian',
  ];
  const LAST_NAMES = [
    'Müller','Schmidt','Schneider','Fischer','Weber','Meyer','Wagner','Becker','Schulz','Hoffmann',
    'Schäfer','Koch','Bauer','Richter','Klein','Wolf','Schröder','Neumann','Schwarz','Zimmermann',
    'Demir','Yılmaz','Kaya','Şahin','Çelik','Yıldız','Aydın','Özdemir','Polat','Korkmaz',
    'Petrov','Vasiliou','Ivanov','Nikolic','Popescu','Mayer','Hartmann','Werner','Lange',
    'Krüger','Schmitt','Lehmann','Schmid','Stein','Frank','Köhler','Vogel','Engel','Krause',
  ];
  const CITY_USERS = (() => {
    const list = [];
    const seedFriends = FRIENDS.filter(f => f.city === 'Wiesbaden');
    for (let i = 0; i < 100; i++) {
      const rank = i + 1;
      const score = Math.round(24000 * Math.pow(rank, -0.78) + 200);
      const fIndex = (i * 7919) % FIRST_NAMES.length;
      const lIndex = (i * 6271) % LAST_NAMES.length;
      list.push({
        id: 'c.' + rank,
        name: FIRST_NAMES[fIndex] + ' ' + LAST_NAMES[lIndex],
        city: 'Wiesbaden',
        score,
        cityRank: rank,
        categoryPoints: {
          finanzen: Math.round(score * 0.42),
          fitness:  Math.round(score * 0.32),
          skills:   Math.round(score * 0.18),
          streaks:  Math.round(score * 0.08),
        },
        achievements: [],
        trophies: rank <= 30 ? [
          { cat: 'auto',  label: rank <= 5 ? 'Porsche 911 GT3' : rank <= 12 ? 'BMW M3 Competition' : rank <= 22 ? 'Audi RS5' : 'BMW 340i', detail: '2024' },
          { cat: 'watch', label: rank <= 5 ? 'Rolex Daytona' : rank <= 15 ? 'Omega Speedmaster' : 'Tudor Black Bay', detail: rank <= 5 ? 'Stahl, weiß' : '2024' },
        ] : [],
      });
    }
    seedFriends.forEach(f => {
      const idx = f.cityRank - 1;
      if (idx >= 0 && idx < list.length) {
        list[idx] = { ...list[idx], ...f, achievements: f.achievements, trophies: f.trophies };
      }
    });
    return list;
  })();

  /* ─── Activity-Feed (cross-friend stream) ─── */
  // Built from all friends' achievements + a few cross-events
  function buildActivityStream() {
    const stream = [];
    FRIENDS.forEach(f => {
      f.achievements.forEach(a => {
        const def = ACHIEVEMENTS.find(x => x.id === a.id);
        if (!def) return;
        stream.push({
          id: f.id + '.' + a.id,
          type: 'achievement',
          friendId: f.id,
          friend: f,
          achievement: def,
          date: a.date,
          cityVerified: a.cityVerified,
          reactions: { fire: Math.floor(Math.random() * 6), heart: Math.floor(Math.random() * 4), clap: Math.floor(Math.random() * 3) },
          comments: Math.random() < 0.3 ? Math.floor(Math.random() * 3) + 1 : 0,
        });
      });
    });
    // sort by date desc
    stream.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return stream;
  }

  /* ─── Mock Squads ─── */
  const MOCK_SQUADS = [
    {
      id: 'sq.crew',
      name: 'Wiesbaden Hustlers',
      emoji: '⚡',
      members: ['me', 'f.marc', 'f.tim', 'f.yusuf'],
      createdAt: '2026-03-15',
    },
    {
      id: 'sq.gym',
      name: 'Iron Brothers',
      emoji: '🔥',
      members: ['me', 'f.marc', 'f.leo'],
      createdAt: '2026-04-02',
    },
  ];

  /* ─── Mock Challenges (incoming from friends) ─── */
  const CHALLENGE_STAKE = 1000;  // fixed point transfer
  const MOCK_CHALLENGES = [
    {
      id: 'ch.marc.bench100',
      from: 'f.marc',
      to: 'me',
      achievementId: 'fit.bench.100',
      deadline: '2026-06-15',
      status: 'pending',  // pending | active | won | lost | declined | expired
      createdAt: '2026-04-30',
    },
    {
      id: 'ch.tim.side1k',
      from: 'f.tim',
      to: 'me',
      achievementId: 'fin.side.1k',
      deadline: '2026-08-01',
      status: 'pending',
      createdAt: '2026-04-29',
    },
    {
      id: 'ch.yusuf.run5k',
      from: 'f.yusuf',
      to: 'me',
      achievementId: 'fit.run.5k.22',
      deadline: '2026-06-30',
      status: 'pending',
      createdAt: '2026-04-28',
    },
  ];

  /* ─── Countries (with rough x/y on equirectangular world map) ─── */
  // x: 0-360 (longitude+180), y: 0-180 (latitude inverted)
  const COUNTRIES = [
    { id: 'DE', name: 'Deutschland', flag: '🇩🇪', continent: 'EU', x: 190, y: 60 },
    { id: 'FR', name: 'Frankreich',  flag: '🇫🇷', continent: 'EU', x: 184, y: 64 },
    { id: 'IT', name: 'Italien',     flag: '🇮🇹', continent: 'EU', x: 192, y: 68 },
    { id: 'ES', name: 'Spanien',     flag: '🇪🇸', continent: 'EU', x: 178, y: 70 },
    { id: 'GB', name: 'UK',          flag: '🇬🇧', continent: 'EU', x: 180, y: 56 },
    { id: 'NL', name: 'Niederlande', flag: '🇳🇱', continent: 'EU', x: 188, y: 58 },
    { id: 'CH', name: 'Schweiz',     flag: '🇨🇭', continent: 'EU', x: 189, y: 65 },
    { id: 'AT', name: 'Österreich',  flag: '🇦🇹', continent: 'EU', x: 192, y: 64 },
    { id: 'PL', name: 'Polen',       flag: '🇵🇱', continent: 'EU', x: 198, y: 60 },
    { id: 'GR', name: 'Griechenland',flag: '🇬🇷', continent: 'EU', x: 202, y: 72 },
    { id: 'PT', name: 'Portugal',    flag: '🇵🇹', continent: 'EU', x: 174, y: 70 },
    { id: 'SE', name: 'Schweden',    flag: '🇸🇪', continent: 'EU', x: 195, y: 48 },
    { id: 'NO', name: 'Norwegen',    flag: '🇳🇴', continent: 'EU', x: 191, y: 46 },
    { id: 'TR', name: 'Türkei',      flag: '🇹🇷', continent: 'EU', x: 210, y: 72 },
    { id: 'CZ', name: 'Tschechien',  flag: '🇨🇿', continent: 'EU', x: 194, y: 62 },
    { id: 'HR', name: 'Kroatien',    flag: '🇭🇷', continent: 'EU', x: 196, y: 67 },

    { id: 'US', name: 'USA',         flag: '🇺🇸', continent: 'NA', x: 80,  y: 70 },
    { id: 'CA', name: 'Kanada',      flag: '🇨🇦', continent: 'NA', x: 80,  y: 50 },
    { id: 'MX', name: 'Mexiko',      flag: '🇲🇽', continent: 'NA', x: 80,  y: 90 },

    { id: 'BR', name: 'Brasilien',   flag: '🇧🇷', continent: 'SA', x: 130, y: 130 },
    { id: 'AR', name: 'Argentinien', flag: '🇦🇷', continent: 'SA', x: 120, y: 155 },
    { id: 'CO', name: 'Kolumbien',   flag: '🇨🇴', continent: 'SA', x: 110, y: 110 },
    { id: 'PE', name: 'Peru',        flag: '🇵🇪', continent: 'SA', x: 110, y: 130 },
    { id: 'CL', name: 'Chile',       flag: '🇨🇱', continent: 'SA', x: 115, y: 155 },

    { id: 'CN', name: 'China',       flag: '🇨🇳', continent: 'AS', x: 280, y: 75 },
    { id: 'JP', name: 'Japan',       flag: '🇯🇵', continent: 'AS', x: 305, y: 78 },
    { id: 'KR', name: 'Südkorea',    flag: '🇰🇷', continent: 'AS', x: 296, y: 78 },
    { id: 'IN', name: 'Indien',      flag: '🇮🇳', continent: 'AS', x: 255, y: 95 },
    { id: 'TH', name: 'Thailand',    flag: '🇹🇭', continent: 'AS', x: 275, y: 100 },
    { id: 'VN', name: 'Vietnam',     flag: '🇻🇳', continent: 'AS', x: 282, y: 100 },
    { id: 'ID', name: 'Indonesien',  flag: '🇮🇩', continent: 'AS', x: 285, y: 120 },
    { id: 'AE', name: 'UAE / Dubai', flag: '🇦🇪', continent: 'AS', x: 235, y: 88 },
    { id: 'SG', name: 'Singapur',    flag: '🇸🇬', continent: 'AS', x: 280, y: 115 },
    { id: 'PH', name: 'Philippinen', flag: '🇵🇭', continent: 'AS', x: 295, y: 105 },

    { id: 'EG', name: 'Ägypten',     flag: '🇪🇬', continent: 'AF', x: 210, y: 90 },
    { id: 'MA', name: 'Marokko',     flag: '🇲🇦', continent: 'AF', x: 178, y: 85 },
    { id: 'ZA', name: 'Südafrika',   flag: '🇿🇦', continent: 'AF', x: 210, y: 145 },
    { id: 'KE', name: 'Kenia',       flag: '🇰🇪', continent: 'AF', x: 218, y: 115 },
    { id: 'NG', name: 'Nigeria',     flag: '🇳🇬', continent: 'AF', x: 195, y: 105 },

    { id: 'AU', name: 'Australien',  flag: '🇦🇺', continent: 'OC', x: 305, y: 145 },
    { id: 'NZ', name: 'Neuseeland',  flag: '🇳🇿', continent: 'OC', x: 335, y: 160 },
  ];
  const CONTINENTS = {
    EU: 'Europa', NA: 'Nordamerika', SA: 'Südamerika',
    AS: 'Asien', AF: 'Afrika', OC: 'Ozeanien',
  };

  /* ─── helpers ─── */
  function findAchievement(id) { return ACHIEVEMENTS.find(a => a.id === id); }
  function findFriend(id) { return FRIENDS.find(f => f.id === id); }
  function findCountry(id) { return COUNTRIES.find(c => c.id === id); }

  return {
    CATEGORIES,
    ACHIEVEMENTS,
    FRIENDS,
    SEARCH_POOL,
    CITY_USERS,
    MOCK_CHALLENGES,
    CHALLENGE_STAKE,
    MOCK_SQUADS,
    COUNTRIES,
    CONTINENTS,
    avatarColor,
    findAchievement,
    findFriend,
    findCountry,
    buildActivityStream,
  };
})();
