import { render, screen, fireEvent } from "@testing-library/react";
import { GameCard, GameCardProps, GameCardStatus } from "../GameCard";
import { CheckCircle, PlayCircle, AlertCircle } from "lucide-react";

// Minimal mock for next/link
jest.mock("next/link", () => {
  return function MockLink({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) {
    return <a href={href}>{children}</a>;
  };
});

const completedStatus: GameCardStatus = {
  label: "Completed",
  color: "text-green-400",
  bg: "bg-green-500/10",
  border: "border-green-500/20",
  icon: CheckCircle,
};

const inProgressStatus: GameCardStatus = {
  label: "Round 3 of 7",
  color: "text-indigo-400",
  bg: "bg-indigo-500/10",
  border: "border-indigo-500/20",
  icon: PlayCircle,
};

const notStartedStatus: GameCardStatus = {
  label: "Not Started",
  color: "text-yellow-400",
  bg: "bg-yellow-500/10",
  border: "border-yellow-500/20",
  icon: AlertCircle,
};

const defaultProps: GameCardProps = {
  id: "game-123",
  name: "ScoreJudge - Friday Night",
  createdTime: "2026-03-20T10:00:00Z",
  status: notStartedStatus,
  showDelete: true,
  isDeleting: false,
  onDelete: jest.fn(),
};

describe("GameCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders game name without ScoreJudge prefix", () => {
    render(<GameCard {...defaultProps} />);
    expect(screen.getByText("Friday Night")).toBeInTheDocument();
  });

  it("renders game link pointing to the game page", () => {
    render(<GameCard {...defaultProps} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/game/game-123");
  });

  it("displays the status label", () => {
    render(<GameCard {...defaultProps} status={inProgressStatus} />);
    expect(screen.getByText("Round 3 of 7")).toBeInTheDocument();
  });

  it("shows Resume text for in-progress games", () => {
    render(<GameCard {...defaultProps} status={inProgressStatus} />);
    expect(screen.getByText("Resume")).toBeInTheDocument();
  });

  it("shows View Stats for completed games", () => {
    render(<GameCard {...defaultProps} status={completedStatus} />);
    expect(screen.getByText("View Stats")).toBeInTheDocument();
  });

  it("does not show Resume for not started games", () => {
    render(<GameCard {...defaultProps} status={notStartedStatus} />);
    expect(screen.queryByText("Resume")).not.toBeInTheDocument();
  });

  it("shows Hidden badge when isHidden is true", () => {
    render(<GameCard {...defaultProps} isHidden={true} />);
    expect(screen.getByText("Hidden")).toBeInTheDocument();
  });

  it("does not show Hidden badge when isHidden is false", () => {
    render(<GameCard {...defaultProps} isHidden={false} />);
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });

  it("calls onDelete when delete button is clicked", () => {
    const onDelete = jest.fn();
    render(<GameCard {...defaultProps} onDelete={onDelete} />);
    const deleteButton = screen.getByTitle(
      "Permanently remove or leave game"
    );
    fireEvent.click(deleteButton);
    expect(onDelete).toHaveBeenCalledWith("game-123", expect.any(Object));
  });

  it("hides delete button when showDelete is false", () => {
    render(<GameCard {...defaultProps} showDelete={false} />);
    expect(
      screen.queryByTitle("Permanently remove or leave game")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTitle("Hide from dashboard")
    ).not.toBeInTheDocument();
  });

  it("disables delete button when isDeleting is true", () => {
    render(<GameCard {...defaultProps} isDeleting={true} />);
    const deleteButton = screen.getByTitle(
      "Permanently remove or leave game"
    );
    expect(deleteButton).toBeDisabled();
  });

  it("shows 'Hide from dashboard' title for completed games", () => {
    render(
      <GameCard {...defaultProps} status={completedStatus} showDelete={true} />
    );
    expect(screen.getByTitle("Hide from dashboard")).toBeInTheDocument();
  });

  it("displays creation date", () => {
    render(<GameCard {...defaultProps} />);
    // The date is formatted via toLocaleDateString so just check the element renders
    expect(screen.getByText(/3\/20\/2026/)).toBeInTheDocument();
  });
});
