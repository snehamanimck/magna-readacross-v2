using MagnaReadAcross.Api.Data;
using MagnaReadAcross.Api.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MagnaReadAcross.Api.Controllers;

[ApiController]
[Route("api/wave/cosma")]
public class CosmaWaveController : ControllerBase
{
    private readonly MagnaDbContext _db;
    public CosmaWaveController(MagnaDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CosmaWaveInitiative>>> Get(CancellationToken ct)
        => Ok(await _db.CosmaWaveInitiatives.AsNoTracking().ToListAsync(ct));

    [HttpGet("{id}")]
    public async Task<ActionResult<CosmaWaveInitiative>> GetById(string id, CancellationToken ct)
    {
        var row = await _db.CosmaWaveInitiatives.AsNoTracking()
                          .FirstOrDefaultAsync(x => x.InitiativeId == id, ct);
        return row is null ? NotFound() : Ok(row);
    }
}

[ApiController]
[Route("api/wave/powertrain")]
public class PowertrainWaveController : ControllerBase
{
    private readonly MagnaDbContext _db;
    public PowertrainWaveController(MagnaDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PowertrainWaveInitiative>>> Get(CancellationToken ct)
        => Ok(await _db.PowertrainWaveInitiatives.AsNoTracking().ToListAsync(ct));

    [HttpGet("{id}")]
    public async Task<ActionResult<PowertrainWaveInitiative>> GetById(string id, CancellationToken ct)
    {
        var row = await _db.PowertrainWaveInitiatives.AsNoTracking()
                          .FirstOrDefaultAsync(x => x.InitiativeId == id, ct);
        return row is null ? NotFound() : Ok(row);
    }
}

[ApiController]
[Route("api/wave/exteriors")]
public class ExteriorsWaveController : ControllerBase
{
    private readonly MagnaDbContext _db;
    public ExteriorsWaveController(MagnaDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ExteriorsWaveInitiative>>> Get(CancellationToken ct)
        => Ok(await _db.ExteriorsWaveInitiatives.AsNoTracking().ToListAsync(ct));

    [HttpGet("{id}")]
    public async Task<ActionResult<ExteriorsWaveInitiative>> GetById(string id, CancellationToken ct)
    {
        var row = await _db.ExteriorsWaveInitiatives.AsNoTracking()
                          .FirstOrDefaultAsync(x => x.InitiativeId == id, ct);
        return row is null ? NotFound() : Ok(row);
    }
}

[ApiController]
[Route("api/wave/seating")]
public class SeatingWaveController : ControllerBase
{
    private readonly MagnaDbContext _db;
    public SeatingWaveController(MagnaDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SeatingWaveInitiative>>> Get(CancellationToken ct)
        => Ok(await _db.SeatingWaveInitiatives.AsNoTracking().ToListAsync(ct));

    [HttpGet("{id}")]
    public async Task<ActionResult<SeatingWaveInitiative>> GetById(string id, CancellationToken ct)
    {
        var row = await _db.SeatingWaveInitiatives.AsNoTracking()
                          .FirstOrDefaultAsync(x => x.InitiativeId == id, ct);
        return row is null ? NotFound() : Ok(row);
    }
}
