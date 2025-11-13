// Points calculation constants
const POINTS = {
  TARGET_WORD_BASE: 100,
  TARGET_WORD_PER_LETTER_PENALTY: 10,
  CONTACT_SUCCESS_CLUE_GIVER: 20,
  CONTACT_SUCCESS_GUESSER: 15,
  WORDMASTER_CORRECT_BLOCK: 10,
  FIRST_TO_GUESS_BONUS: 25,
};

export function calculateTargetWordPoints(
  revealedLettersCount,
  _targetWordLength
) {
  const basePoints = POINTS.TARGET_WORD_BASE;
  const penalty =
    (revealedLettersCount - 1) * POINTS.TARGET_WORD_PER_LETTER_PENALTY;
  return Math.max(basePoints - penalty, 20); // Minimum 20 points
}

export function getContactSuccessPoints() {
  return {
    clueGiver: POINTS.CONTACT_SUCCESS_CLUE_GIVER,
    guesser: POINTS.CONTACT_SUCCESS_GUESSER,
  };
}

export function getWordmasterBlockPoints() {
  return POINTS.WORDMASTER_CORRECT_BLOCK;
}

export function getFirstToGuessBonus() {
  return POINTS.FIRST_TO_GUESS_BONUS;
}

export function checkContactMatch(contacts, clueWord) {
  console.log('Number of contacts:', contacts.length);

  if (contacts.length === 0) {
    return { matched: false, matchedWord: null, matchedPlayers: [] };
  }

  // Check if ALL contacts match the clue word
  const allMatch = contacts.every(
    (c) => c.word.toUpperCase() === clueWord.toUpperCase()
  );

  if (allMatch) {
    const matchedPlayers = contacts.map((c) => c.playerId);
    return {
      matched: true,
      matchedWord: clueWord,
      matchedPlayers,
    };
  }

  // Not all matched - show what we got
  const wordGroups = {};
  contacts.forEach((contact) => {
    const word = contact.word.toUpperCase();
    if (!wordGroups[word]) {
      wordGroups[word] = [];
    }
    wordGroups[word].push(contact.playerId);
  });

  return {
    matched: false,
    matchedWord: null,
    matchedPlayers: [],
  };
}

export function getNextRevealedLetter(targetWord, currentRevealed) {
  const nextIndex = currentRevealed.length;
  if (nextIndex >= targetWord.length) {
    return null;
  }
  return targetWord[nextIndex];
}

export function checkTargetWordGuess(guess, targetWord) {
  return guess.toUpperCase() === targetWord.toUpperCase();
}

export function checkClueWordGuess(guess, clueWord) {
  return guess.toUpperCase() === clueWord.toUpperCase();
}

export function validateClueWord(clueWord, revealedLetters) {
  const upperClue = clueWord.toUpperCase();
  const revealedStr = revealedLetters.join('');
  return upperClue.startsWith(revealedStr);
}

export function generatePlayerId() {
  return `player_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function formatGameLog(event, data, playerNicknames) {
  const getNickname = (playerId) => {
    return playerNicknames[playerId] || playerId;
  };

  switch (event) {
    case 'game_started':
      return 'Game started! Wordmaster has chosen the target word.';

    case 'round_started':
      return `Round ${data.roundNumber} started. ${getNickname(data.clueGiverId)} is giving a clue.`;

    case 'clue_submitted':
      return `${getNickname(data.clueGiverId)} submitted a clue: "${data.clue}"`;

    case 'second_clue_submitted':
      return `${getNickname(data.clueGiverId)} submitted a second clue: "${data.clue}"`;

    case 'contact_clicked':
      return `${getNickname(data.playerId)} clicked Contact!`;

    case 'contact_updated':
      return `${getNickname(data.playerId)} updated their contact guess.`;

    case 'contact_removed':
      return `${getNickname(data.playerId)} removed their contact guess.`;

    case 'wordmaster_guess':
      if (data.correct) {
        return `Wordmaster guessed "${data.guess}" - CORRECT! The clue word was blocked.`;
      }
      return `Wordmaster guessed "${data.guess}" - Incorrect. ${data.guessesRemaining} guesses remaining.`;

    case 'round_ended':
      return `Round ${data.roundNumber} ended.`;

    case 'contact_success':
      return `Successful contact! The clue word was "${data.clueWord}". Next letter revealed: ${data.newLetter}`;

    case 'contact_failed':
      return `Contact failed. Guesses didn't match. Clue word was "${data.clueWord}".`;

    case 'target_word_guess':
      if (data.correct) {
        return `🎉 ${getNickname(data.playerId)} guessed the target word: "${data.targetWord}"! Game over!`;
      }
      return `${getNickname(data.playerId)} made an incorrect target word guess.`;

    case 'game_completed':
      return `Game completed! Winner: ${getNickname(data.winnerId)} with ${data.points} points!`;

    default:
      return data.message || 'Game event occurred.';
  }
}
