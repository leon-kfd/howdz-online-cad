# Core Module Patterns

## Architecture
- **EntityManager** owns all entities, handles add/remove/select operations
- **ToolManager** dispatches mouse/keyboard events to active tool
- **Renderer** renders entities from EntityManager + overlay from active tool
- Tools receive `ToolContext` with mouse position, ortho mode, scale

## Adding New Entity Types
1. Extend `Entity` base class in Entity.ts
2. Implement all abstract methods: `getBoundingBox`, `getGripPoints`, `draw`, `hitTest`, `move`, `moveGripPoint`, `clone`
3. Add type to `EntityType` union in Entity.ts
4. Register in `EntityManager` (automatic - just add entity instances)

## Adding New Tools
1. Extend `BaseTool` or implement `Tool` interface in tools/Tool.ts
2. Register in `ToolManager` via `toolManager.register(tool)`
3. Tools receive `ToolContext` with `orthoMode`, `mouseWorld`, `scale`
4. Use `drawOverlay()` for temporary preview graphics
5. Register tool in `CAD.ts` `setupTools()` method

## Command Line
- `CAD.executeCommand()` parses command string and dispatches
- Format: `COMMAND arg1 arg2` (e.g., `LINE 0,0 100,100`)
- Tools can provide static `parseCommandLine()` for argument parsing

## Rendering
- Main render loop runs continuously via `requestAnimationFrame`
- Entity rendering happens in `Renderer.drawEntities()` 
- Tool overlay rendered after entities, before crosshair
- Entity `draw()` method receives viewport for coordinate conversion

## Selection
- `EntityManager` manages selection state via `selectedSet`
- Supports single select, toggle (Shift+click), box select, cross select
- Selected entities rendered with `selected: true` flag in `draw()`

## Grip Point Editing
- `EntityManager.hitTestGripPoint()` finds nearest grip on selected entities only (avoids conflicts with click selection)
- Grip hit-testing uses 5px tolerance converted to world coordinates
- `SelectTool` checks grip hit first, then entity hit, then starts box selection
- During grip drag, `entity.moveGripPoint(gripIndex, x, y)` is called in real-time on mouseMove
- `GripHitResult` interface: `{ entity, gripIndex, point }`

## Property Panel Integration
- `SelectTool.onSelectionChange` callback fires after any selection change (click, box select, shift toggle, clear)
- Subscribe via `selectTool.onSelectionChange = () => { ... }` from external code
- Entity-specific properties accessed via type guard: `entity.type === 'line'` then cast to access `getLength()`, `startX`, etc.
