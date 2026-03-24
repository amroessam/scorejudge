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
    isEliminated: boolean; // True if player cannot win or move up significantly

    // Offensive hints - to catch up to player(s) above
    catchUp?: CatchUpHint;

    // Defensive hints - about threat from player(s) below
    stayAhead?: StayAheadHint;

    // Win condition hints
    winCondition?: WinCondition;
}

/**
 * Helper to calculate final round number
 */
function getFinalRoundNumber(numPlayers: number): number {
    const maxCards = Math.floor(52 / numPlayers);
    return maxCards * 2 - 1;
}

/**
 * Helper to get cards for a specific round index
 */
function getCardsForRound(roundIndex: number, numPlayers: number): number {
    const maxCards = Math.floor(52 / numPlayers);
    if (roundIndex <= maxCards) {
        // Round 1-10 (for 5 players): 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
        return maxCards - (roundIndex - 1);
    } else {
        // Round 11-19 (for 5 players): 2, 3, 4, 5, 6, 7, 8, 9, 10
        return (roundIndex - maxCards) + 1;
    }
}

/**
 * Calculate total potential points remaining in the game
 */
function getTotalRemainingPotential(currentRoundIndex: number, numPlayers: number): number {
    const finalRound = getFinalRoundNumber(numPlayers);
    let total = 0;
    for (let i = currentRoundIndex; i <= finalRound; i++) {
        const cards = getCardsForRound(i, numPlayers);
        // Max points per round: bid full amount + bonus (cards) = cards + cards = 2 * cards
        total += (2 * cards);
    }
    return total;
}

/**
 * Calculate strategic predictions for a player
 * 
 * Scoring logic:
 * - If bid made: points = bid + cardsInRound
 * - If bid missed: points = 0
 */
export function calculatePredictions(
    currentPlayerEmail: string,
    players: Player[],
    currentRoundIndex: number,
    cardsInRound: number,
    numPlayers: number,
    isFinalRound: boolean
): PredictionHints {
    const maxBid = cardsInRound;
    const minPossibleWinningScore = cardsInRound; // Any bid made (min 0) + bonus
    const maxPossibleWinningScore = maxBid + cardsInRound; // Bid max + bonus

    const remainingPotential = getTotalRemainingPotential(currentRoundIndex + 1, numPlayers);
    const totalPossibleRestOfGame = maxPossibleWinningScore + remainingPotential;

    // Sort players by score descending
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

    // Check if all scores are 0 (Round 1 pre-score)
    const allScoresZero = sortedPlayers.every(p => p.score === 0);
    if (allScoresZero) {
        return {
            show: false,
            position: 1,
            tiedWith: [],
            isEliminated: false,
        };
    }

    // Find current player
    const currentPlayer = sortedPlayers.find(p => p.email === currentPlayerEmail);
    if (!currentPlayer) {
        return {
            show: false,
            position: 1,
            tiedWith: [],
            isEliminated: false,
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
        isEliminated: false,
    };

    // === OFFENSIVE HINTS (Catch up to player above) ===
    if (myIndex > 0) {
        const playerAbove = sortedPlayers[myIndex - 1];
        const gap = playerAbove.score - myScore;

        if (playerAbove.score === myScore) {
            // Tied - any successful bid breaks the tie (if they miss)
            result.catchUp = {
                targetName: playerAbove.name,
                targetScore: playerAbove.score,
                minBid: 0,
                impossible: false,
                minBidIfTheyMake: 1, // Need at least 1 more if they also make bid
                impossibleIfTheyMake: false
            };
        } else {
            // Scenario 1: They miss their bid (get 0 pts)
            // You need gap + 1 points to pass them
            const minBidIfTheyMiss = Math.max(0, gap + 1 - cardsInRound);
            const impossibleIfTheyMiss = minBidIfTheyMiss > maxBid;

            // Scenario 2: They make their bid (min possible score is cardsInRound)
            // You need gap + cardsInRound + 1 points to pass them
            const minBidIfTheyMake = Math.max(0, gap + 1);
            const impossibleIfTheyMake = minBidIfTheyMake > maxBid;

            result.catchUp = {
                targetName: playerAbove.name,
                targetScore: playerAbove.score,
                minBid: impossibleIfTheyMiss ? maxBid : minBidIfTheyMiss,
                impossible: impossibleIfTheyMiss,
                minBidIfTheyMake: minBidIfTheyMake,
                impossibleIfTheyMake: impossibleIfTheyMake
            };

            // Elimination Check: Can they EVER pass the person above for the rest of the game?
            if (gap > remainingPotential + maxPossibleWinningScore) {
                result.isEliminated = true;
            }
        }
    }

    // === DEFENSIVE HINTS (Stay ahead of player below) ===
    if (myIndex < sortedPlayers.length - 1) {
        const playerBelow = sortedPlayers[myIndex + 1];
        const gap = myScore - playerBelow.score;

        // Scenario 1: You make your bid (min points = cardsInRound)
        // They need gap + cardsInRound + 1 points to pass you
        // Bid needed = (gap + cardsInRound + 1) - cardsInRound = gap + 1
        const theyNeedIfYouMake = gap + 1;
        const youAreSafeIfYouMake = theyNeedIfYouMake > maxBid;

        // Scenario 2: You miss your bid (0 pts)
        // They need gap + 1 points to pass you
        // Bid needed = (gap + 1) - cardsInRound
        const theyNeedIfYouMiss = Math.max(0, gap + 1 - cardsInRound);
        const youAreSafeIfYouMiss = theyNeedIfYouMiss > maxBid;

        result.stayAhead = {
            threatName: playerBelow.name,
            threatScore: playerBelow.score,
            theyNeedBid: youAreSafeIfYouMiss ? maxBid + 1 : theyNeedIfYouMiss,
            youAreSafe: youAreSafeIfYouMiss,
            // For internal use
            theyNeedIfYouMake: youAreSafeIfYouMake ? maxBid + 1 : theyNeedIfYouMake,
            youAreSafeIfYouMake
        } as any;
    }

    // === WIN CONDITION HINTS ===
    if (position === 1) {
        const secondPlace = sortedPlayers.find(p => p.score < myScore);

        if (!secondPlace) {
            if (tiedWith.length > 0) {
                result.winCondition = {
                    type: 'if_others_lose',
                    message: `Tied! Make your bid to take the lead.`,
                };
            }
        } else {
            const gap = myScore - secondPlace.score;

            // Check if victory is guaranteed for the whole game
            const secondPlaceMaxPossible = secondPlace.score + remainingPotential + maxPossibleWinningScore;
            if (myScore > secondPlaceMaxPossible) {
                result.winCondition = {
                    type: 'guaranteed',
                    message: `🏆 Victory secured! No one can catch you.`,
                };
            } else {
                // Not guaranteed yet. Analyze this round.
                const stayAhead = result.stayAhead as any;
                if (stayAhead) {
                    if (stayAhead.youAreSafe) {
                        result.winCondition = {
                            type: 'lead_maintained',
                            message: `Safe in 1st this round!`,
                        };
                    } else if (stayAhead.youAreSafeIfYouMake) {
                        result.winCondition = {
                            type: 'if_others_lose',
                            message: isFinalRound
                                ? `Make your bid to win! (Otherwise, make ${stayAhead.threatName} lose)`
                                : `Make your bid to stay in 1st!`,
                        };
                    } else {
                        result.winCondition = {
                            type: 'if_others_lose',
                            message: `Make ${stayAhead.threatName} lose to keep the lead!`,
                        };
                    }
                }
            }
        }
    } else if (isFinalRound && result.catchUp && !result.isEliminated) {
        // Final round catch-up advice
        if (!result.catchUp.impossibleIfTheyMake) {
            result.winCondition = {
                type: 'if_others_lose',
                message: `Bid ${result.catchUp.minBidIfTheyMake}+ to guaranteed overtake ${result.catchUp.targetName}!`,
            };
        } else if (!result.catchUp.impossible) {
            result.winCondition = {
                type: 'if_others_lose',
                message: `Overtake ${result.catchUp.targetName} if they miss! (Need ${formatBidHint(result.catchUp.minBid)})`,
            };
        }
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
