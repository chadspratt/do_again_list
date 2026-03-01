Do Again List - An un-todo list for tracking the last time you did things that you want to do more/less frequently/regularly

Sorts events from most recent to least. Avoid doing things that you wish you did less but did recently and find something you wish you did more and haven't done for while.


## Contributing

This repo is organized for building into a python package with the intent to be installed (pip) and imported normally. It follows [standard Python packaging practices](https://packaging.python.org/en/latest/).

Package management, dependency management, and virtual environment provisioning is handled by [`uv`](https://docs.astral.sh/uv/getting-started/installation/).

### Focused development

This repo ships with a _minimal_ Django project so that the app can be run in a consistent way for a low-friction developer experience.

To run the included project:

```
cd test_project
python manage.py migrate
python manage.py runserver
```

The included `Justfile` provides targets for doing most common tasks. [Install `just`](https://just.systems/man/en/packages.html).

### Other options

A contributor who wishes to develop this package as part of a larger (multi-app) project would be advised to use this repo as a submodule of their larger project:

```
my-integrated-project/           # the big boi container for all your ongoing app projects
├── my_integrated_project/       # the actual Django project which is the integrated project
│   ├── my_integrated_project/   # the "project app" for the integrated project
│   │   └── ...                  # bunch of stuff (out of scope)
│   ├── db.sqlite3               # file-based database can live here
│   └── manage.py                # use this to `runserver` the integrated project
├── do-again-list/               # THIS REPO (top level)
│   ├── frontend/                # the root of the python project called `do_again_list`
│   │   └── ...                  # yadda yadda yadda
│   ├── do_again_list/           # the root of the python project called `do_again_list`
│   │   ├── migrations/          # this stuff exists in this repo!
│   │   ├── models.py            # where the models are defined
│   │   └── ...                  # the rest of the owl
│   ├── ...                      # & cetera
│   ├── README.md                # THIS EXACT FILE YOU'RE READING!
│   └── pyproject.toml           # defines how the `do_again_list` package will be built
├── other-fun-thing/             # some other django app repo
│   └── ...                      # a bunch of (probably more interesting) stuff
├── Dockerfile                   # Instructions on building the integrated project into an image
└── pyproject.toml               # lists all the dependencies for the integrated project
```

You can see the `pyproject.toml` for this repo.
It provides all the instructions needed to build this repo as a python package.

It is appropriate to [install this package as "editable"](https://setuptools.pypa.io/en/latest/userguide/development_mode.html) to make it available your Django project:

```
cd `do-again-list`
python -m pip install -e do_again_list
```

To specify editable installation within `pyproject.toml` (appropriate within `my-integrated-project/pyproject.toml`):

```
[project]
name = "my-integrated-project"
dependencies = [
    "django>=5.0.0",
    "do-again-list",
]

[tool.uv.sources]
do-again-list = { path = "./do-again-list", editable = true }
```

Recommendations for `my-integrated-project/Dockerfile` are available upon request.


## Recommendations

### Easy
- [x] Make `PastEvent` model singular (e.g. `PastEvent`)
- [x] remove explicit definition of `id` fields in models (django always provides an `id` column with sensible defaults)
- [x] remove explicit definition of `db_table`
- switch to service architecture for mutating models (`models.GameState` -> `services.GameStateService.add_xp(game_state, amount)`)
- switch to using standard library date parsing (rather than having shadow `dateutil` dependency)
- Defer user registration/auth to project (not app level concern)
- remove unused `do_again_list/templates/do_again_list/dashboard.html`
- rework API to be more restful:
  - paths: `/api/<module>/<resource>/<id>/<action>`. First token should be set by project.
  - correctly use HTTP verbs (GET, PATCH, POST, DELETE) rather than mangling GET endpoints with actions like `update`
- Switch any model field representing a duration to use the built-in `models.DurationField`
- Create dedicated model for `items`

### Medium

#### Model Naming Friction
There is naming friction between `PastEvent` and `HistoricalEvent`; historical events usually being in the past (and vice-versa) and all. `PastEvent` isn't really even (quite) a past event, given that it has a predicted future time. This could just be `Event` (or maybe there is an even more descriptive name for this fundamental resource).

Looking a bit more I think I understand the structure:
- `PastEvent` holds all the detail about what the thing you're doing _is_. Name, typical duration, time between, value, all that stuff. It also holds an _actual time_ when this occurred.
- `HistoricalEvent` references a `PastEvent` and gives an _actual time_ when this `PastEvent` occurred.

**PROPOSE**:
- Phase 1:
  - Rename `PastEvent` to `Activity`
  - Rename `HistoricalEvent` to `Occurance`, or (more dryly) `ActivityInstance`
- Phase 2:
  - Remove the specification of the _actual time_ from `Activity`
  - Rework service code to create a `Occurance` for any _actual time_ logging (even for the first occurance of the activity).
  - __This proposition adheres to typical database table normalization practices (1NF).__
- Phase 3:
  - Remove `next_time` from `Activity`
  - Add `predicted_start_time` to `Occurance` to indicate when a occurance _ought_ to occur.
  - Retool service code to create a _future_ `occurance` setting the `predicted_start_time`.
  - Retool service code to update the `occurance` with actual start and end time when the user does the `activity`.


### Harder
- Decouple service and view (e.g. `views.api_update_event` needs to be at least two layers: view and controller)
- Adopt more formal API patterns using [Django Rest Framework](https://www.django-rest-framework.org/)
  - Easier serialization (avoids much boilerplate like `views.api_update_event_settings`)
  - Standard viewsets reduce boilerplate, ensure standard behavior
