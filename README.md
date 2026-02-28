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
