// "How to play" slides for each game, shown by TutorialModal.
// Keep these in step with the rules code (e.g. games/<game>/<game>Rules.js).

export const TUTORIALS = {
  trivia: [
    { emoji: '🎯', heading: 'How to Play Trivia', body: 'Answer multiple-choice questions by tapping your answer. Each correct answer earns points based on difficulty.' },
    { emoji: '🔥', heading: 'Streak Bonus', body: 'Get 3 or more correct answers in a row to earn a 1.5× streak bonus on every subsequent correct answer!' },
    { emoji: '⏱️', heading: 'The Timer', body: 'A timer counts down for each question — it\'s just a hint, not a deadline. Take your time and choose wisely.' },
    { emoji: '⭐', heading: 'Difficulty Levels', body: 'Easy: basic knowledge\nMedium: moderate challenge\nHard: deep expertise required (biblical scholars beware — these are tough!)' },
  ],
  solitaire: [
    { emoji: '🃏', heading: 'Goal', body: 'Move all 52 cards to the four foundation piles, one per suit, from Ace up to King.' },
    { emoji: '📐', heading: 'Tableau Rules', body: 'Build columns in descending order, alternating red/black colors. Only Kings may be placed on empty columns.' },
    { emoji: '👆', heading: 'Moving Cards', body: 'Tap a card to select it (highlighted), then tap the card or empty space you want to move it onto. Tap a selected card again to send it up to its foundation. Or drag-and-drop cards directly!' },
    { emoji: '🃏', heading: 'Stock Pile', body: 'Tap the face-down stock pile to flip cards to the waste. When stock is empty, tap it again to recycle the waste.' },
    { emoji: '✨', heading: 'Auto-Move', body: 'Tap "Auto-Move to Foundation" at the bottom to automatically send any eligible cards to the foundations.' },
  ],
  hearts: [
    { emoji: '♥️', heading: 'Goal', body: 'Avoid taking tricks that contain hearts (1 point each) or the Queen of Spades (13 points). When someone reaches 100, the lowest score wins!' },
    { emoji: '🔄', heading: 'Passing', body: 'Before each hand, pass 3 cards: to the left, then right, then across, then no pass — and repeat.\nPassing high hearts and a lonely Q♠ is a good idea.' },
    { emoji: '🎮', heading: 'Playing Tricks', body: 'Whoever holds the 2♣ leads it. Follow the suit led if you can; otherwise play anything. The highest card of the suit led wins the trick.\nNo hearts or Q♠ may be played on the first trick unless you have nothing else.' },
    { emoji: '🚫', heading: 'Breaking Hearts', body: 'You can\'t lead a heart until a heart has been played on an earlier trick (unless you only have hearts left).' },
    { emoji: '🌙', heading: 'Shoot the Moon', body: 'Take ALL 13 hearts plus the Queen of Spades and you score 0 — everyone else gets 26!' },
  ],
  spades: [
    { emoji: '♠️', heading: 'Goal', body: 'Work with your partner (across the table) to win at least as many tricks as you bid. Spades are always trump. First team to 500 wins.' },
    { emoji: '🤔', heading: 'Bidding', body: 'Before playing, everyone bids how many tricks they expect to win; you and your partner\'s bids are added together. Bid "Nil" to try to win no tricks at all.' },
    { emoji: '🎮', heading: 'Playing', body: 'Follow the suit led if you can. Spades beat every other suit. You can\'t lead spades until one has been played, unless you only have spades.' },
    { emoji: '📊', heading: 'Scoring', body: 'Make your bid: 10 points per trick bid, +1 for each extra trick (a "bag"). Miss it: lose 10 per trick bid.\nEvery 10 bags costs 100 points!\nNil: +100 if you win no tricks, −100 if you win any.' },
  ],
  golf6: [
    { emoji: '⛳', heading: 'Goal', body: 'Get the lowest score! Unlike most card games — in Golf, low score wins.' },
    { emoji: '🃏', heading: 'Setup', body: 'Everyone gets 6 face-down cards in a 2×3 grid. Turn 2 of yours face-up to start.' },
    { emoji: '🔄', heading: 'Your Turn', body: 'Draw from the deck or take the top discard. Swap it with any card in your grid (that card is discarded), or discard it. Or, without drawing, just flip one face-down card.' },
    { emoji: '🏁', heading: 'Ending', body: 'When a player has all 6 cards face-up, everyone else gets one last turn. If the deck runs out, the discard pile is shuffled back in.' },
    { emoji: '🔢', heading: 'Scoring', body: 'Joker = −4 • 2 = −2 • King = 0 • Ace = 1 • 3–10 = face value • Jack = 11 • Queen = 12\nTwo matching cards in the same column score 0!' },
  ],
  rook: [
    { emoji: '🐦', heading: 'Goal', body: 'You and your partner (across the table) try to capture counter cards. First team to 300 wins.' },
    { emoji: '🃏', heading: 'The Deck', body: 'Cards 1–14 in four colours (Black, Green, Red, Yellow) plus the Rook bird.\nCounters: 5s = 5 points, 10s and 14s = 10 points, the Rook = 20 points — 120 in all.' },
    { emoji: '🏆', heading: 'Bidding', body: 'Bid how many points your team will capture, from 70 up to 120 in steps of 5. Pass and you\'re out of the bidding. The highest bidder wins.' },
    { emoji: '💰', heading: 'The Nest', body: 'The bid winner takes the 5-card nest, puts back any 5 cards, and names trump. Points left in the nest go to whoever wins the last trick.' },
    { emoji: '🎮', heading: 'Playing', body: 'Follow the colour led if you can. Trump beats other colours, and the Rook bird is the highest trump of all.\nMake your bid to score your points — miss it and you lose the whole bid!' },
  ],
  bridge: [
    { emoji: '🃏', heading: 'Goal', body: 'As declarer, win at least as many tricks as your contract. As defenders, stop the declarer from making their contract.' },
    { emoji: '🗣️', heading: 'Bidding', body: 'The dealer bids first, and the deal rotates each hand. A bid is the number of tricks ABOVE 6 you expect to win, plus a trump suit (or No Trump). Each bid must be higher than the last; three passes in a row end the bidding.' },
    { emoji: '🤝', heading: 'Dummy', body: 'After the opening lead, declarer\'s partner (dummy) lays their hand face-up and declarer plays both hands.\nWhen you declare, tap dummy\'s cards on its turn. When North declares, North plays your cards for you.' },
    { emoji: '📊', heading: 'Scoring', body: 'Making your contract earns points by suit and level, plus bonuses for game (100+ trick points) and slams. Each trick short gives the defenders 50 points.' },
  ],
  jigsaw: [
    { emoji: '🧩', heading: 'Goal', body: 'Assemble all the puzzle pieces to recreate the original photo. Choose a photo from your library to get started!' },
    { emoji: '📸', heading: 'Choose a Photo', body: 'Tap "Add a Photo" to pick one from your photo library (or take a new one). The puzzle will be cut from that picture.' },
    { emoji: '🖐️', heading: 'Placing Pieces', body: 'Drag pieces up from the tray onto the board (swipe sideways to scroll the tray). Drop a piece close to its correct spot and it locks into place. Tap "Picture" any time to see the finished picture.' },
    { emoji: '🎚️', heading: 'Difficulty', body: 'Easy: 16 pieces • Medium: 30 pieces • Hard: 64 pieces • Expert: 100 pieces.' },
  ],
  match3: [
    { emoji: '🌸', heading: 'Goal', body: 'Swipe a flower toward a neighbour to swap them (or tap one, then the other) and line up 3 or more of the same kind. Reach the level goal before you run out of moves!' },
    { emoji: '✨', heading: 'Special Tiles', body: '🌟 Match 4 in a line = star (clears its row)\n💧 Match 5 in a line = water drop (clears its column)\n☀️ Match in an L or T shape = sun (clears a 3×3 area)\n\nA special keeps its flower, with a badge in the corner — match it with that flower to set it off. Everything a blast clears scores points, and a blast that hits another special sets it off too!' },
    { emoji: '🪨', heading: 'Blockers', body: 'Brown blocker tiles can\'t be moved or matched. Make a match right next to one to break it.' },
    { emoji: '🎯', heading: 'Level Goals', body: 'Score: reach the target score\nCollect: match a certain flower enough times\nClear: break all the blockers\n\nIf no moves are possible, the board reshuffles for you.' },
  ],
};
