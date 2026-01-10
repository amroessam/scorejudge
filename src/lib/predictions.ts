import { Player } from "./store";

export interface CatchUpHint {
    targetName: string;
    targetScore: number;
    minBid: number;
    impossible: boolean; // True if gap too large even if they miss
    minBidIfTheyMake?: number;
    impossibleIfTheyMake?: boolean;
}

export interface StayAheadHint {
    threatName: string;
    threatScore: number;
    theyNeedBid: number; // Min bid they need to catch you
    youAreSafe: boolean; // True if they mathematically can't catch you
}

export interface WinCondition {
    type: 'guaranteed' | 'if_others_lose' | 'lead_maintained';
    message: string;
}

export interface PredictionHints {
    show: boolean; // False if all scores are 0
    position: number; // Current rank (1 = first)
    tiedWith: string[]; // Names of players with same score

    // Offensive hints - to catch up to player(s) above
    catchUp?: CatchUpHint;

    // Defensive hints - about threat from player(s) below
    stayAhead?: StayAheadHint;

    // Win condition hints
    winCondition?: WinCondition;
}

/**
 * Calculate strategic predictions for a player
 * 
 * Scoring formula: If tricksTaken === bid, points = bid + totalCardsDealt, else 0
 * totalCardsDealt = cardsPerPlayer * numPlayers
 */
export function calculatePredictions(
    currentPlayerEmail: string,
    players: Player[],
    cardsPerPlayer: number,
    numPlayers: number,
    isFinalRound: boolean
): PredictionHints {
    const totalCardsDealt = cardsPerPlayer * numPlayers;
    const maxBid = cardsPerPlayer; // Can't bid more than cards dealt to you
    const maxPossibleScore = maxBid + totalCardsDealt; // Max points from one round

    // Sort players by score descending
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

    // Check if all scores are 0
    const allScoresZero = sortedPlayers.every(p => p.score === 0);
    if (allScoresZero) {
        return {
            show: false,
            position: 1,
            tiedWith: [],
        };
    }

    // Find current player
    const currentPlayer = sortedPlayers.find(p => p.email === currentPlayerEmail);
    if (!currentPlayer) {
        return {
            show: false,
            position: 1,
            tiedWith: [],
        };
    }

    const myScore = currentPlayer.score;
    const myIndex = sortedPlayers.findIndex(p => p.email === currentPlayerEmail);
    const position = myIndex + 1;

    // Find tied players
    const tiedWith = sortedPlayers
        .filter(p => p.score === myScore && p.email !== currentPlayerEmail)
        .map(p => p.name);

    const result: PredictionHints = {
        show: true,
        position,
        tiedWith,
    };

    // === OFFENSIVE HINTS (Catch up to player above) ===
    if (myIndex > 0) {
        // Find player directly above (or first player with higher score for ties)
        const playerAbove = sortedPlayers[myIndex - 1];

        // If tied with player above, need just 1 point more than 0 to break tie
        if (playerAbove.score === myScore) {
            // We're tied - any successful bid breaks the tie
            result.catchUp = {
                targetName: playerAbove.name,
                targetScore: playerAbove.score,
                minBid: 0, // Even bid 0 made gives totalCardsDealt points
                impossible: false,
            };
        } else {
            const gap = playerAbove.score - myScore;

            // Scenario 1: They miss their bid (get 0 pts)
            // You need gap + 1 points to pass them
            const pointsNeededIfTheyMiss = gap + 1;
            const minBidIfTheyMiss = Math.max(0, pointsNeededIfTheyMiss - totalCardsDealt);
            const impossibleIfTheyMiss = minBidIfTheyMiss > maxBid;

            // Scenario 2: They make their bid (min possible score is totalCardsDealt)
            // You need gap + totalCardsDealt + 1 points to pass them
            const pointsNeededIfTheyMake = gap + totalCardsDealt + 1;
            const minBidIfTheyMake = Math.max(0, pointsNeededIfTheyMake - totalCardsDealt);
            const impossibleIfTheyMake = minBidIfTheyMake > maxBid;

            result.catchUp = {
                targetName: playerAbove.name,
                targetScore: playerAbove.score,
                minBid: impossibleIfTheyMiss ? maxBid : minBidIfTheyMiss,
                impossible: impossibleIfTheyMiss,
                minBidIfTheyMake: minBidIfTheyMake,
                impossibleIfTheyMake: impossibleIfTheyMake
            };
        }
    }

    // === DEFENSIVE HINTS (Stay ahead of player below) ===
    if (myIndex < sortedPlayers.length - 1) {
        // Find player directly below
        const playerBelow = sortedPlayers[myIndex + 1];
        const gap = myScore - playerBelow.score;

        // They can score at most maxPossibleScore
        // They need to close the gap, so they need: gap + 1 points
        // points = bid + totalCardsDealt, so they need bid >= (gap + 1 - totalCardsDealt)
        const theyNeedPoints = gap + 1;
        const theyNeedBid = Math.max(0, theyNeedPoints - totalCardsDealt);
        const youAreSafe = theyNeedBid > maxBid;

        result.stayAhead = {
            threatName: playerBelow.name,
            threatScore: playerBelow.score,
            theyNeedBid: youAreSafe ? maxBid + 1 : theyNeedBid,
            youAreSafe,
        };
    }

    // === WIN CONDITION HINTS ===
    if (position === 1) {
        // I'm in 1st place (possibly tied)
        const secondPlace = sortedPlayers.find(p => p.score < myScore);

        if (!secondPlace) {
            // Everyone is tied for 1st
            if (tiedWith.length > 0) {
                result.winCondition = {
                    type: 'if_others_lose',
                    message: `Tied for 1st! Any successful bid wins it.`,
                };
            }
        } else {
            const gap = myScore - secondPlace.score;

            // Check if win is guaranteed (gap > max possible score)
            if (gap > maxPossibleScore) {
                result.winCondition = {
                    type: 'guaranteed',
                    message: `🏆 Victory secured! No one can catch you.`,
                };
            } else if (isFinalRound) {
                // Check "if everyone loses" scenario
                // If all players below score 0, I stay in 1st
                const canWinByDefault = gap > 0;
                if (canWinByDefault) {
                    result.winCondition = {
                        type: 'if_others_lose',
                        message: `If everyone misses, you win!`,
                    };
                }
            } else {
                // Not final round, but leading
                result.winCondition = {
                    type: 'lead_maintained',
                    message: `Leading by ${gap} pts`,
                };
            }
        }
    }

    // Handle ties at 1st - add context
    if (position === 1 && tiedWith.length > 0 && !result.winCondition) {
        result.winCondition = {
            type: 'if_others_lose',
            message: `Tied! Any made bid wins.`,
        };
    }

    return result;
}

/**
 * Format the minimum bid for display
 * If minBid is 0, any successful bid works
 */
export function formatBidHint(minBid: number): string {
    if (minBid === 0) {
        return "Any bid made";
    }
    return `Bid ${minBid}+`;
}
