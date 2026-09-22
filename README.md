# MakhanaX

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.3.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Docker

Build and run the production image locally:

```bash
docker build --build-arg BUILD_CONFIGURATION=production -t makhanax:local .
docker run --rm -p 8080:8080 makhanax:local
```

Open `http://localhost:8080` after the container starts.

After a successful GitHub Actions build on `dev`, `test`, or `prod`, the same
image is pushed automatically to Docker Hub. Configure the repository secrets
`DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` first.

Each branch has a stable tag and an immutable build tag:

```text
<dockerhub-username>/makhanax:dev
<dockerhub-username>/makhanax:dev-build-42-20260922-143015
<dockerhub-username>/makhanax:test
<dockerhub-username>/makhanax:test-build-43-20260922-143120
<dockerhub-username>/makhanax:prod
<dockerhub-username>/makhanax:prod-build-44-20260922-143225
```

The build number comes from GitHub Actions and the timestamp is UTC.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
