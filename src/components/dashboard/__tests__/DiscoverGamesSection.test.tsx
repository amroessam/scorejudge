import { render, screen } from "@testing-library/react";
import {
  DiscoverGamesSection,
  DiscoverGamesSectionProps,
  DiscoverableGame,
} from "../DiscoverGamesSection";

const sampleGames: DiscoverableGame[] = [
  {
    id: "game-1",
    name: "Friday Night",
    ownerEmail: "alice@example.com",
    playerCount: 3,
  },
  {
    id: "game-2",
    name: "Saturday Game",
    ownerEmail: "bob@example.com",
    playerCount: 5,
  },
];

const defaultProps: DiscoverGamesSectionProps = {
  games: sampleGames,
  loading: false,
  onJoin: jest.fn(),
};

describe("DiscoverGamesSection", () => {
  it("renders the section heading", () => {
    render(<DiscoverGamesSection {...defaultProps} />);
    expect(screen.getByText("Discover Games")).toBeInTheDocument();
  });

  it("renders all discoverable games", () => {
    render(<DiscoverGamesSection {...defaultProps} />);
    expect(screen.getByText("Friday Night")).toBeInTheDocument();
    expect(screen.getByText("Saturday Game")).toBeInTheDocument();
  });

  it("renders nothing when games array is empty", () => {
    const { container } = render(
      <DiscoverGamesSection {...defaultProps} games={[]} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows loading spinner when loading is true", () => {
    render(<DiscoverGamesSection {...defaultProps} loading={true} />);
    expect(screen.getByText("Discover Games")).toBeInTheDocument();
    // Game names should not appear while loading
    expect(screen.queryByText("Friday Night")).not.toBeInTheDocument();
  });

  it("shows game cards when loading is false", () => {
    render(<DiscoverGamesSection {...defaultProps} loading={false} />);
    expect(screen.getByText("Friday Night")).toBeInTheDocument();
    expect(screen.getByText("Saturday Game")).toBeInTheDocument();
  });
});
