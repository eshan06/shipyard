// shipyard is the terminal client for the Shipyard preview-environments
// platform. It talks to the same REST + SSE surface the dashboard uses,
// authenticated with a team-scoped API token.
//
// Usage: see `shipyard help` (cli.Usage).
package main

import (
	"context"
	"flag"
	"fmt"
	"os"

	"github.com/eshan06/shipyard/cli/internal/cli"
)

func main() {
	args := os.Args[1:]
	if len(args) == 0 || args[0] == "help" || args[0] == "-h" || args[0] == "--help" {
		fmt.Print(cli.Usage)
		return
	}

	ctx := context.Background()

	switch args[0] {
	case "version":
		fmt.Println("shipyard", cli.Version)

	case "previews":
		if len(args) < 2 {
			cli.Fail(fmt.Errorf("previews needs a subcommand: list|get|stop|redeploy|destroy|pin"))
		}
		runPreviews(ctx, args[1], args[2:])

	case "logs":
		fs := flag.NewFlagSet("logs", flag.ExitOnError)
		var opts cli.Options
		cli.BindGlobal(fs, &opts)
		parse(fs, args[1:])
		ref := requireRef(fs, "logs <id|slug>")
		if err := cli.Logs(ctx, opts, ref); err != nil {
			cli.Fail(err)
		}

	case "status":
		fs := flag.NewFlagSet("status", flag.ExitOnError)
		var opts cli.Options
		watch := fs.Bool("watch", false, "stream live status transitions")
		cli.BindGlobal(fs, &opts)
		parse(fs, args[1:])
		ref := requireRef(fs, "status <id|slug>")
		if err := cli.Status(ctx, opts, ref, *watch); err != nil {
			cli.Fail(err)
		}

	default:
		fmt.Print(cli.Usage)
		os.Exit(2)
	}
}

// runPreviews dispatches the `previews` verb family.
func runPreviews(ctx context.Context, verb string, rest []string) {
	fs := flag.NewFlagSet("previews "+verb, flag.ExitOnError)
	var opts cli.Options
	cli.BindGlobal(fs, &opts)

	switch verb {
	case "list":
		status := fs.String("status", "", "filter by status (RUNNING, FAILED, …)")
		limit := fs.Int("limit", 50, "max rows")
		parse(fs, rest)
		if err := cli.PreviewsList(ctx, opts, *status, *limit); err != nil {
			cli.Fail(err)
		}

	case "get":
		parse(fs, rest)
		ref := requireRef(fs, "previews get <id|slug>")
		if err := cli.PreviewsGet(ctx, opts, ref); err != nil {
			cli.Fail(err)
		}

	case "stop", "redeploy", "destroy", "pin":
		yes := fs.Bool("yes", false, "confirm a destructive action")
		parse(fs, rest)
		ref := requireRef(fs, "previews "+verb+" <id|slug>")
		if err := cli.PreviewAction(ctx, opts, ref, verb, *yes); err != nil {
			cli.Fail(err)
		}

	default:
		cli.Fail(fmt.Errorf("unknown previews subcommand %q", verb))
	}
}

// parse runs flag parsing; ExitOnError makes failures terminal already.
func parse(fs *flag.FlagSet, args []string) {
	_ = fs.Parse(args)
}

// requireRef returns the single positional argument or dies with usage.
func requireRef(fs *flag.FlagSet, usage string) string {
	if fs.NArg() != 1 {
		cli.Fail(fmt.Errorf("usage: shipyard %s", usage))
	}
	return fs.Arg(0)
}
