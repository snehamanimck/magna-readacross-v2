namespace MagnaReadAcross.Api.Services.Pnl;

public sealed record PnlMetricDefinition(
    string Key,
    string Label,
    string? Units,
    string? Calc,
    string Direction,
    IReadOnlyList<string> Numerator,
    IReadOnlyList<string> Denominator);

public static class PnlMetricCatalog
{
    public static readonly IReadOnlyList<PnlMetricDefinition> Metrics =
    [
        new(
            "profitability",
            "Profitability",
            "$",
            "EBITDA / Prod Revenue",
            "higher_better",
            ["EBITDA"],
            ["production_sales"]),
        new(
            "opex_ratio",
            "Operating expense ratio",
            "$",
            "(Production L&B + Wages + Materials + VOH + Scrap) / Prod Revenue",
            "lower_better",
            ["DL", "wages", "materials", "VOH", "scrap_expense"],
            ["production_sales"]),
        new(
            "labour_benefits_ratio",
            "Production labour and benefits ratio",
            "$",
            "Production L&B / Prod Revenue",
            "lower_better",
            ["DL"],
            ["production_sales"]),
        new(
            "wages_ratio",
            "Wages ratio",
            "$",
            "Wages / Prod Revenue",
            "lower_better",
            ["wages"],
            ["production_sales"]),
        new(
            "prod_materials_ratio",
            "Production materials ratio",
            "$",
            "Materials / Prod Revenue",
            "lower_better",
            ["materials"],
            ["production_sales"]),
        new(
            "voh_ratio",
            "VOH ratio",
            "$",
            "VOH / Prod Revenue",
            "lower_better",
            ["VOH"],
            ["production_sales"]),
        new(
            "scrap_ratio",
            "Scrap ratio",
            "$",
            "Scrap / Prod Revenue",
            "lower_better",
            ["scrap_expense"],
            ["production_sales"]),
    ];
}
