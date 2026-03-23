import { render, screen, fireEvent } from "@testing-library/react";
import {
  DiscoverableGameCard,
  DiscoverableGameCardProps,
} from "../DiscoverableGameCard";

const defaultProps: DiscoverableGameCardProps = {
  id: "game-abc",
  name: "Friday Night Judgement",
  ownerEmail: "host@example.com",
  playerCount: 4,
  onJoin: jest.fn(),
};

describe("DiscoverableGameCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the game name", () => {
    render(<DiscoverableGameCard {...defaultProps} />);
    expect(screen.getByText("Friday Night Judgement")).toBeInTheDocument();
  });

  it("displays the player count", () => {
    render(<DiscoverableGameCard {...defaultProps} />);
    expect(screen.getByText("4/12")).toBeInTheDocument();
  });

  it("displays the owner email", () => {
    render(<DiscoverableGameCard {...defaultProps} />);
    expect(screen.getByText("Owner: host@example.com")).toBeInTheDocument();
  });

  it("calls onJoin with the game id when Join button is clicked", () => {
    const onJoin = jest.fn();
    render(<DiscoverableGameCard {...defaultProps} onJoin={onJoin} />);
    const joinButton = screen.getByText("Join").closest("button")!;
    fireEvent.click(joinButton);
    expect(onJoin).toHaveBeenCalledWith("game-abc");
  });

  it("renders the Join button text", () => {
    render(<DiscoverableGameCard {...defaultProps} />);
    expect(screen.getByText("Join")).toBeInTheDocument();
  });
});
