// ============================================================================
//  BROOKDALE LEAGUE — 2026 PRESEASON POWER RANKINGS — DATA
//  import BROOKDALE_LEAGUE_PRESEASON_POWER_RANKINGS_V213174 from "~/league-treasurer/ben-blackmail/../power-rankings/2026"
//
//  Edit this file to change stats / rosters / win conditions.
//  - Write-ups + taglines live in writeups.js (keyed by `slug`).
//  - All-time history (from League Report.xlsx) lives in history.js (keyed by manager first name).
//  - `subtitle` is the one-line headline rendered under the team name (a <p class="subtitle"> on the team page).
//  - `profile` = the manager's profile picture (thumbnail in the file list + avatar on the file page).
//  - `meme` = the meme shown in the image box on the file page. `thumb` is kept as an alias of `meme`.
//    Replace the files in img/ (jpg or png, just match the path here).
//  - Roster `status` tags: "Q" = questionable, "CEL" = as listed on Yahoo.
// ============================================================================

window.BROOKDALE = {
  league: "The Brookdale League",
  leagueId: "341380",
  season: 2026,
  importPath: '~/league-treasurer/ben-blackmail/../power-rankings/2026',
  version: "V213174",
  teams: [
    {
      rank: 1,
      slug: "hoes-mad",
      file: "01_HOES_MAD.rank",
      name: "Hoes Mad",
      manager: "Alex (ANK)",
      subtitle: "ALL GAS NO BRAKES",
      profile: "img/hoes-mad-profile.jpg",
      meme: "img/hoes-mad-meme.jpg",
      thumb: "img/hoes-mad-meme.jpg",
      projectedRecord: "10-4",
      playoff: { pct: 80, odds: "-400" },
      finals: { pct: 34, odds: "+190" },
      championship: { pct: 19, odds: "+425" },
      avgAge: 25.6,
      top30RBs: 3,
      playoffStreak: 1,
      playoffDrought: null,
      avgPFHalf: 110.9,
      avgPAHalf: 110.6,
      tenure: 13,
      winCondition:
        "def winCondition():\n" +
        "    if ceedee_ppg + bijan_ppg > 40:\n" +
        "        return True\n" +
        "    return False",
      roster: {
        starters: [
          { pos: "QB", name: "Drake Maye", team: "NE" },
          { pos: "RB", name: "Bijan Robinson", team: "Atl" },
          { pos: "RB", name: "Cam Skattebo", team: "NYG" },
          { pos: "WR", name: "CeeDee Lamb", team: "Dal" },
          { pos: "WR", name: "A.J. Brown", team: "NE" },
          { pos: "TE", name: "Sam LaPorta", team: "Det", status: "Q" },
          { pos: "W/R/T", name: "Jaylen Waddle", team: "Den" },
          { pos: "K", name: "Harrison Mevis", team: "LAR" },
          { pos: "DEF", name: "Texans", team: "Hou" }
        ],
        bench: [
          { pos: "RB", name: "Jonathon Brooks", team: "Car", status: "Q" },
          { pos: "RB", name: "Jacory Croskey-Merritt", team: "Was", status: "Q" },
          { pos: "WR", name: "Quentin Johnston", team: "LAC" },
          { pos: "RB", name: "Kenny Gainwell", team: "TB" },
          { pos: "WR", name: "Jalen Nailor", team: "LV" },
          { pos: "RB", name: "Brian Robinson", team: "Atl" }
        ]
      }
    },
    {
      rank: 2,
      slug: "hammertime",
      file: "02_HAMMERTIME.rank",
      name: "HammerTime",
      manager: "Caleb",
      subtitle: "I'M GOING TO ASSUME BLIND LUCK",
      profile: "img/hammertime-profile.jpg",
      meme: "img/hammertime-meme.jpg",
      thumb: "img/hammertime-meme.jpg",
      projectedRecord: "9-5",
      playoff: { pct: 76, odds: "-315" },
      finals: { pct: 30, odds: "+230" },
      championship: { pct: 16, odds: "+525" },
      avgAge: 26.1,
      top30RBs: 2,
      playoffStreak: 1,
      playoffDrought: null,
      avgPFHalf: 109.2,
      avgPAHalf: 109.2,
      tenure: 13,
      winCondition:
        "def winCondition():\n" +
        "    if jettas == STARTABLE:\n" +
        "        return True\n" +
        "    return False",
      roster: {
        starters: [
          { pos: "QB", name: "Jalen Hurts", team: "Phi" },
          { pos: "RB", name: "James Cook III", team: "Buf" },
          { pos: "RB", name: "Javonte Williams", team: "Dal" },
          { pos: "WR", name: "Justin Jefferson", team: "Min" },
          { pos: "WR", name: "Zay Flowers", team: "Bal", status: "Q" },
          { pos: "TE", name: "Tyler Warren", team: "Ind", status: "Q" },
          { pos: "W/R/T", name: "Tetairoa McMillan", team: "Car" },
          { pos: "K", name: "Tyler Loop", team: "Bal" },
          { pos: "DEF", name: "Rams", team: "LAR" }
        ],
        bench: [
          { pos: "WR", name: "Christian Watson", team: "GB" },
          { pos: "RB", name: "RJ Harvey", team: "Den" },
          { pos: "RB", name: "Blake Corum", team: "LAR" },
          { pos: "WR", name: "DK Metcalf", team: "Pit", status: "Q" },
          { pos: "QB", name: "Trevor Lawrence", team: "Jax" },
          { pos: "WR", name: "Jakobi Meyers", team: "Jax", status: "Q" }
        ]
      }
    },
    {
      rank: 3,
      slug: "mr-glass-reborn",
      file: "03_MR._GLASS_REBORN.rank",
      name: "Mr. Glass Reborn",
      manager: "Gabe",
      subtitle: "HE'S CHEATING BUT I CAN'T PROVE IT",
      profile: "img/mr-glass-reborn-profile.jpg",
      meme: "img/mr-glass-reborn-meme.jpg",
      thumb: "img/mr-glass-reborn-meme.jpg",
      projectedRecord: "9-5",
      playoff: { pct: 75, odds: "-300" },
      finals: { pct: 29, odds: "+245" },
      championship: { pct: 15, odds: "+565" },
      avgAge: 25.5,
      top30RBs: 4,
      playoffStreak: null,
      playoffDrought: 1,
      avgPFHalf: 110.7,
      avgPAHalf: 108.0,
      tenure: 4,
      winCondition:
        "def winCondition():\n" +
        "    if achane_health > 0.75 and achane_carries > 225:\n" +
        "        return True\n" +
        "    return False",
      roster: {
        starters: [
          { pos: "QB", name: "Justin Herbert", team: "LAC" },
          { pos: "RB", name: "Jonathan Taylor", team: "Ind" },
          { pos: "RB", name: "De'Von Achane", team: "Mia" },
          { pos: "WR", name: "Nico Collins", team: "Hou" },
          { pos: "WR", name: "Luther Burden III", team: "Chi", status: "Q" },
          { pos: "TE", name: "Trey McBride", team: "Ari" },
          { pos: "W/R/T", name: "Quinshon Judkins", team: "Cle" },
          { pos: "K", name: "Ka'imi Fairbairn", team: "Hou" },
          { pos: "DEF", name: "Eagles", team: "Phi" }
        ],
        bench: [
          { pos: "WR", name: "Marvin Harrison Jr.", team: "Ari" },
          { pos: "RB", name: "Tony Pollard", team: "Ten" },
          { pos: "WR", name: "Jordan Addison", team: "Min" },
          { pos: "RB", name: "Aaron Jones Sr.", team: "Min" },
          { pos: "WR", name: "Makai Lemon", team: "Phi" },
          { pos: "WR", name: "Wan'Dale Robinson", team: "Ten", status: "Q" }
        ]
      }
    },
    {
      rank: 4,
      slug: "saxwillruintheleague",
      file: "04_SAXWILLRUINTHELEAGUE.rank",
      name: "SaxWillRuinTheLeague",
      manager: "Dale",
      subtitle: "I AM INEVITABLE",
      profile: "img/saxwillruintheleague-profile.jpg",
      meme: "img/saxwillruintheleague-meme.jpg",
      thumb: "img/saxwillruintheleague-meme.jpg",
      projectedRecord: "8-6",
      playoff: { pct: 69, odds: "-225" },
      finals: { pct: 24, odds: "+315" },
      championship: { pct: 12, odds: "+735" },
      avgAge: 27.2,
      top30RBs: 4,
      playoffStreak: 4,
      playoffDrought: null,
      avgPFHalf: 114.6,
      avgPAHalf: 110.8,
      tenure: 13,
      winCondition:
        "def winCondition():\n" +
        "    if love_final_ranking < 10:\n" +
        "        return True\n" +
        "    return False",
      roster: {
        starters: [
          { pos: "QB", name: "Jayden Daniels", team: "Was" },
          { pos: "RB", name: "Jahmyr Gibbs", team: "Det" },
          { pos: "RB", name: "Jeremiyah Love", team: "Ari", status: "Q" },
          { pos: "WR", name: "Drake London", team: "Atl" },
          { pos: "WR", name: "Davante Adams", team: "LAR" },
          { pos: "TE", name: "Harold Fannin Jr.", team: "Cle" },
          { pos: "W/R/T", name: "Breece Hall", team: "NYJ", status: "Q" },
          { pos: "K", name: "Chase McLaughlin", team: "TB" },
          { pos: "DEF", name: "Jaguars", team: "Jax" }
        ],
        bench: [
          { pos: "RB", name: "TreVeyon Henderson", team: "NE", status: "Q" },
          { pos: "RB", name: "Chuba Hubbard", team: "Car", status: "Q" },
          { pos: "WR", name: "Stefon Diggs", team: "Was" },
          { pos: "WR", name: "Terry McLaurin", team: "Was" },
          { pos: "QB", name: "Matthew Stafford", team: "LAR" },
          { pos: "RB", name: "Rachaad White", team: "Was", status: "Q" }
        ]
      }
    },
    {
      rank: 5,
      slug: "killer-whales",
      file: "05_KILLER_WHALES.rank",
      name: "🐳 Killer Whales 🐳",
      manager: "Chris",
      subtitle: "HE'S CHEATING AND I CAN PROVE IT",
      profile: "img/killer-whales-profile.jpg",
      meme: "img/killer-whales-meme.jpg",
      thumb: "img/killer-whales-meme.jpg",
      projectedRecord: "8-6",
      playoff: { pct: 68, odds: "-210" },
      finals: { pct: 23, odds: "+335" },
      championship: { pct: 11, odds: "+800" },
      avgAge: 25.2,
      top30RBs: 2,
      playoffStreak: 2,
      playoffDrought: null,
      avgPFHalf: 112.6,
      avgPAHalf: 107.6,
      tenure: 13,
      winCondition:
        "def winCondition():\n" +
        "    if any(wr == STARTABLE for wr in bench_wrs) and allen_final_ranking < 3 and not burger == EATEN:\n" +
        "        return True\n" +
        "    return False",
      roster: {
        starters: [
          { pos: "QB", name: "Josh Allen", team: "Buf" },
          { pos: "RB", name: "Kyren Williams", team: "LAR" },
          { pos: "RB", name: "Ashton Jeanty", team: "LV", status: "Q" },
          { pos: "WR", name: "Jameson Williams", team: "Det" },
          { pos: "WR", name: "Ja'Marr Chase", team: "Cin", status: "Q" },
          { pos: "TE", name: "Colston Loveland", team: "Chi" },
          { pos: "W/R/T", name: "MarShawn Lloyd", team: "GB" },
          { pos: "K", name: "Brandon Aubrey", team: "Dal" },
          { pos: "DEF", name: "Chargers", team: "LAC" }
        ],
        bench: [
          { pos: "WR", name: "DJ Moore", team: "Buf" },
          { pos: "WR", name: "Jayden Reed", team: "GB" },
          { pos: "RB", name: "Chris Rodriguez Jr.", team: "Jax" },
          { pos: "WR", name: "Josh Downs", team: "Ind", status: "Q" },
          { pos: "WR", name: "Brian Thomas Jr.", team: "Jax" },
          { pos: "RB", name: "Jonah Coleman", team: "Den" }
        ]
      }
    },
    {
      rank: 6,
      slug: "schkattebooboo",
      file: "06_SCHKATTEBOOBOO.rank",
      name: "Schkattebooboo",
      manager: "Ben",
      subtitle: "HOW TO BUILD A TEAM THAT IMPLODES BY WEEK 11",
      profile: "img/schkattebooboo-profile.jpg",
      meme: "img/schkattebooboo-meme.jpg",
      thumb: "img/schkattebooboo-meme.jpg",
      projectedRecord: "7-7",
      playoff: { pct: 60, odds: "-150" },
      finals: { pct: 18, odds: "+455" },
      championship: { pct: 8, odds: "+1150" },
      avgAge: 24.6,
      top30RBs: 4,
      playoffStreak: 1,
      playoffDrought: null,
      avgPFHalf: 106.9,
      avgPAHalf: 113.9,
      tenure: 11,
      winCondition:
        "def winCondition():\n" +
        "    if (higgins_health > 0.75 and dowdle != STARTABLE) or bucky == STARTABLE:\n" +
        "        return True\n" +
        "    return False",
      roster: {
        starters: [
          { pos: "QB", name: "Caleb Williams", team: "Chi" },
          { pos: "RB", name: "Omarion Hampton", team: "LAC" },
          { pos: "RB", name: "Bhayshul Tuten", team: "Jax", status: "Q" },
          { pos: "WR", name: "Puka Nacua", team: "LAR", status: "Q" },
          { pos: "WR", name: "Rashee Rice", team: "KC" },
          { pos: "TE", name: "Kyle Pitts Sr.", team: "Atl" },
          { pos: "W/R/T", name: "Tee Higgins", team: "Cin", status: "Q" },
          { pos: "K", name: "Jason Myers", team: "Sea" },
          { pos: "DEF", name: "Vikings", team: "Min" }
        ],
        bench: [
          { pos: "RB", name: "Bucky Irving", team: "TB" },
          { pos: "RB", name: "Jaylen Warren", team: "Pit" },
          { pos: "WR", name: "Michael Wilson", team: "Ari" },
          { pos: "WR", name: "KC Concepcion", team: "Cle" },
          { pos: "RB", name: "Woody Marks", team: "Hou" },
          { pos: "QB", name: "Jaxson Dart", team: "NYG" }
        ]
      }
    },
    {
      rank: 7,
      slug: "eyes-wide-shut",
      file: "07_EYES_WIDE_SHUT.rank",
      name: "Eyes Wide Shut",
      manager: "Van",
      subtitle: "NO GAS NO BRAKES",
      profile: "img/eyes-wide-shut-profile.jpg",
      meme: "img/eyes-wide-shut-meme.jpg",
      thumb: "img/eyes-wide-shut-meme.jpg",
      projectedRecord: "7-7",
      playoff: { pct: 58, odds: "-140" },
      finals: { pct: 17, odds: "+490" },
      championship: { pct: 8, odds: "+1150" },
      avgAge: 26.5,
      top30RBs: 4,
      playoffStreak: 5,
      playoffDrought: null,
      avgPFHalf: 110.3,
      avgPAHalf: 108.2,
      tenure: 7,
      winCondition:
        "def winCondition():\n" +
        "    if not henry == WASHED and mayfield in mvp_contenders:\n" +
        "        return True\n" +
        "    return False",
      roster: {
        starters: [
          { pos: "QB", name: "Dak Prescott", team: "Dal" },
          { pos: "RB", name: "Jadarian Price", team: "Sea" },
          { pos: "RB", name: "Saquon Barkley", team: "Phi" },
          { pos: "WR", name: "Ladd McConkey", team: "LAC" },
          { pos: "WR", name: "Emeka Egbuka", team: "TB", status: "Q" },
          { pos: "TE", name: "Tucker Kraft", team: "GB", status: "Q" },
          { pos: "W/R/T", name: "Derrick Henry", team: "Bal" },
          { pos: "K", name: "Cam Little", team: "Jax" },
          { pos: "DEF", name: "Patriots", team: "NE" }
        ],
        bench: [
          { pos: "WR", name: "Mike Evans", team: "SF", status: "Q" },
          { pos: "RB", name: "Rhamondre Stevenson", team: "NE" },
          { pos: "WR", name: "Alec Pierce", team: "Ind" },
          { pos: "WR", name: "Jalen Coker", team: "Car" },
          { pos: "WR", name: "Matthew Golden", team: "GB" },
          { pos: "WR", name: "Ja'Kobi Lane", team: "Bal" }
        ]
      }
    },
    {
      rank: 8,
      slug: "dhhate",
      file: "08_DHHATE.rank",
      name: "DHhate",
      manager: "Oliver",
      subtitle: "GET READY TO GET GOBBLED",
      profile: "img/dhhate-profile.jpg",
      meme: "img/dhhate-meme.jpg",
      thumb: "img/dhhate-meme.jpg",
      projectedRecord: "5-9",
      playoff: { pct: 45, odds: "+120" },
      finals: { pct: 11, odds: "+810" },
      championship: { pct: 5, odds: "+1900" },
      avgAge: 26.3,
      top30RBs: 2,
      playoffStreak: null,
      playoffDrought: 1,
      avgPFHalf: 105.0,
      avgPAHalf: 111.9,
      tenure: 2,
      winCondition:
        "def winCondition():\n" +
        "    if k9 > chase_brown and jsn > amon_ra:\n" +
        "        return True\n" +
        "    return False",
      roster: {
        starters: [
          { pos: "QB", name: "Joe Burrow", team: "Cin" },
          { pos: "RB", name: "Kenneth Walker III", team: "KC" },
          { pos: "RB", name: "David Montgomery", team: "Hou" },
          { pos: "WR", name: "Jaxon Smith-Njigba", team: "Sea" },
          { pos: "WR", name: "Chris Olave", team: "NO" },
          { pos: "TE", name: "Isaiah Likely", team: "NYG" },
          { pos: "W/R/T", name: "DeVonta Smith", team: "Phi" },
          { pos: "K", name: "Cameron Dicker", team: "LAC", status: "Q" },
          { pos: "DEF", name: "Broncos", team: "Den" }
        ],
        bench: [
          { pos: "WR", name: "Garrett Wilson", team: "NYJ" },
          { pos: "RB", name: "Rico Dowdle", team: "Pit" },
          { pos: "RB", name: "Kyle Monangai", team: "Chi", status: "Q" },
          { pos: "WR", name: "Michael Pittman Jr.", team: "Pit", status: "Q" },
          { pos: "RB", name: "Mike Washington Jr.", team: "LV" },
          { pos: "TE", name: "Greg Dulcich", team: "Mia" }
        ]
      }
    },
    {
      rank: 9,
      slug: "mac-and-movies",
      file: "09_MAC_AND_MOVIES.rank",
      name: "Mac and Movies",
      manager: "Ethan",
      subtitle: "HAS HE LOST HIS TOUCH?",
      profile: "img/mac-and-movies-profile.jpg",
      meme: "img/mac-and-movies-meme.jpg",
      thumb: "img/mac-and-movies-meme.jpg",
      projectedRecord: "5-9",
      playoff: { pct: 44, odds: "+125" },
      finals: { pct: 10, odds: "+900" },
      championship: { pct: 4, odds: "+2400" },
      avgAge: 26.7,
      top30RBs: 2,
      playoffStreak: null,
      playoffDrought: 1,
      avgPFHalf: 108.6,
      avgPAHalf: 109.1,
      tenure: 12,
      winCondition:
        "def winCondition():\n" +
        "    if pickens_final_ranking < 10 and bengals_offense_rank < 10:\n" +
        "        return True\n" +
        "    return False",
      roster: {
        starters: [
          { pos: "QB", name: "Bo Nix", team: "Den" },
          { pos: "RB", name: "Chase Brown", team: "Cin" },
          { pos: "RB", name: "Travis Etienne Jr.", team: "NO" },
          { pos: "WR", name: "Amon-Ra St. Brown", team: "Det" },
          { pos: "WR", name: "George Pickens", team: "Dal" },
          { pos: "TE", name: "Travis Kelce", team: "KC" },
          { pos: "W/R/T", name: "Rome Odunze", team: "Chi", status: "Q" },
          { pos: "K", name: "Chris Boswell", team: "Pit" },
          { pos: "DEF", name: "Seahawks", team: "Sea" }
        ],
        bench: [
          { pos: "TE", name: "George Kittle", team: "SF", status: "Q" },
          { pos: "WR", name: "Parker Washington", team: "Jax" },
          { pos: "RB", name: "J.K. Dobbins", team: "Den" },
          { pos: "WR", name: "De'Zhaun Stribling", team: "SF", status: "Q" },
          { pos: "RB", name: "Keaton Mitchell", team: "LAC", status: "Q" },
          { pos: "WR", name: "Rashid Shaheed", team: "Sea" }
        ]
      }
    },
    {
      rank: 10,
      slug: "hogwash",
      file: "10_HOGWASH.rank",
      name: "Hogwash 🐷",
      manager: "Belsky",
      subtitle: "ALL BRAKES NO GAS",
      profile: "img/hogwash-profile.jpg",
      meme: "img/hogwash-meme.jpg",
      thumb: "img/hogwash-meme.jpg",
      projectedRecord: "2-11-1",
      projectedRecordNote: "ONLY BELSKY WOULD TIE",
      playoff: { pct: 25, odds: "+300" },
      finals: { pct: 4, odds: "+2400" },
      championship: { pct: 2, odds: "+4900" },
      avgAge: 26.4,
      top30RBs: 3,
      playoffStreak: null,
      playoffDrought: 2,
      avgPFHalf: 107.0,
      avgPAHalf: 110.8,
      tenure: 12,
      winCondition:
        "def winCondition():\n" +
        "    if cmc_health > 0.75 and cmc_final_rank < 3 and nabers_health > 0.75 and nabers_final_rank < 10 and jacobs_violence < 1.0:\n" +
        "        return True\n" +
        "    return \"FAILURE: WIN CONDITION NOT ATTAINABLE\"",
      roster: {
        starters: [
          { pos: "QB", name: "Lamar Jackson", team: "Bal" },
          { pos: "RB", name: "Christian McCaffrey", team: "SF", status: "Q" },
          { pos: "RB", name: "D'Andre Swift", team: "Chi", status: "Q" },
          { pos: "WR", name: "Malik Nabers", team: "NYG", status: "Q" },
          { pos: "WR", name: "Carnell Tate", team: "Ten", status: "Q" },
          { pos: "TE", name: "Brock Bowers", team: "LV" },
          { pos: "W/R/T", name: "Courtland Sutton", team: "Den" },
          { pos: "K", name: "Eddy Pineiro", team: "SF" },
          { pos: "DEF", name: "Steelers", team: "Pit" }
        ],
        bench: [
          { pos: "RB", name: "Josh Jacobs", team: "GB", status: "CEL" },
          { pos: "WR", name: "Romeo Doubs", team: "NE" },
          { pos: "WR", name: "Chris Godwin Jr.", team: "TB" },
          { pos: "RB", name: "Jordan Mason", team: "Min" },
          { pos: "RB", name: "Tyler Allgeier", team: "Ari" },
          { pos: "RB", name: "Kaleb Johnson", team: "GB" }
        ]
      }
    }
  ]
};
