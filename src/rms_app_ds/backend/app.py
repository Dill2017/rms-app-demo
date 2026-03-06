from . import seed as _seed  # noqa: F401 — registers the _SeedDependency lifespan

from .core import create_app
from .genie_router import router as genie_router
from .router import router

app = create_app(routers=[router, genie_router])
