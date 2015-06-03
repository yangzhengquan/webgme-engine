/*jshint node:true, mocha:true, expr:true */

/**
 * @author kecso / https://github.com/kecso
 */

var testFixture = require('../_globals');

describe.only('diff CLI tests', function () {
    'use strict';
    var gmeConfig = testFixture.getGmeConfig(),
        storage,
        gmeAuth,
        logger = testFixture.logger.fork('diff.spec'),
        diffCLI = require('../../src/bin/diff'),
        importCLI = require('../../src/bin/import'),
        FS = testFixture.fs,
        getJsonProject = function (path) {
            return JSON.parse(FS.readFileSync(path, 'utf-8'));
        },

        diffCliTest = 'diffCliTest';

    before(function (done) {
        testFixture.clearDBAndGetGMEAuth(gmeConfig, diffCliTest)
            .then(function (gmeAuth__) {
                gmeAuth = gmeAuth__;
                storage = testFixture.getMemoryStorage(logger, gmeConfig, gmeAuth);
                return storage.openDatabase();
            })
            .then(function () {
                return storage.deleteProject({projectName: diffCliTest});
            })
            .nodeify(done);
    });

    after(function (done) {
        storage.closeDatabase(done);
    });

    describe('basic', function () {
        describe('no diff', function () {
            var jsonProject;

            before(function (done) {
                try {
                    jsonProject = getJsonProject('./test/bin/diff/source001.json');
                } catch (err) {
                    done(err);
                    return;
                }
                importCLI.import(storage,
                    gmeConfig, diffCliTest, jsonProject, 'source', true, undefined, function (err) {
                        if (err) {
                            done(err);
                            return;
                        }
                        importCLI.import(storage,
                            gmeConfig, diffCliTest, jsonProject, 'target', true, undefined, done);
                    }
                );
            });

            it('diff should be empty on identical project states source->target', function (done) {
                diffCLI.generateDiff(storage, diffCliTest, 'source', 'target', undefined, function (err, diff) {
                    if (err) {
                        done(err);
                        return;
                    }
                    diff.should.be.empty;
                    done();
                });
            });

            it('diff should be empty on identical project states target->source', function (done) {
                diffCLI.generateDiff(storage, diffCliTest, 'target', 'source', undefined, function (err, diff) {
                    if (err) {
                        done(err);
                        return;
                    }
                    diff.should.be.empty;
                    done();
                });
            });
        });

        describe('simple node difference', function () {
            var source,
                target;

            before(function (done) {
                try {
                    source = getJsonProject('./test/bin/diff/source001.json');
                    target = getJsonProject('./test/bin/diff/target001.json');
                } catch (err) {
                    done(err);
                    return;
                }
                importCLI.import(storage, gmeConfig, diffCliTest, source, 'source', true, undefined, function (err) {
                    if (err) {
                        done(err);
                        return;
                    }
                    importCLI.import(storage, gmeConfig, diffCliTest, target, 'target', true, undefined, done);
                });
            });

            it('new node should be visible in diff source->target', function (done) {
                diffCLI.generateDiff(storage, diffCliTest, 'source', 'target', undefined, function (err, diff) {
                    if (err) {
                        done(err);
                        return;
                    }

                    diff.should.include.key('2');
                    diff['2'].should.include.key('hash');
                    diff['2'].should.include.key('removed');
                    diff['2'].removed.should.be.equal(false);
                    done();
                });
            });

            it('node remove should be visible in diff target->source', function (done) {
                diffCLI.generateDiff(storage, diffCliTest, 'target', 'source', undefined, function (err, diff) {
                    if (err) {
                        done(err);
                        return;
                    }
                    diff.should.include.key('2');
                    diff['2'].should.include.key('removed');
                    diff['2'].removed.should.be.equal(true);
                    done();
                });
            });
        });

        describe('simple attribute change', function () {
            var source,
                target;

            before(function (done) {
                try {
                    source = getJsonProject('./test/bin/diff/source001.json');
                    target = JSON.parse(JSON.stringify(source));
                    target.nodes['cd891e7b-e2ea-e929-f6cd-9faf4f1fc045'].attributes.name = 'FCOmodified';
                } catch (err) {
                    done(err);
                    return;
                }
                importCLI.import(storage, gmeConfig, diffCliTest, source, 'source', true, undefined, function (err) {
                    if (err) {
                        done(err);
                        return;
                    }
                    importCLI.import(storage, gmeConfig, diffCliTest, target, 'target', true, undefined, done);
                });
            });

            it('changed attribute should be visible in diff source->target', function (done) {
                diffCLI.generateDiff(storage, diffCliTest, 'source', 'target', undefined, function (err, diff) {
                    if (err) {
                        done(err);
                        return;
                    }

                    diff.should.include.key('1');
                    diff['1'].should.include.key('attr');
                    diff['1'].attr.should.include.key('name');
                    diff['1'].attr.name.should.be.equal('FCOmodified');
                    done();
                });
            });

            it('changed attribute should be visible in diff target->source', function (done) {
                diffCLI.generateDiff(storage, diffCliTest, 'target', 'source', undefined, function (err, diff) {
                    if (err) {
                        done(err);
                        return;
                    }
                    diff.should.include.key('1');
                    diff['1'].should.include.key('attr');
                    diff['1'].attr.should.include.key('name');
                    diff['1'].attr.name.should.be.equal('FCO');
                    done();
                });
            });
        });

        describe('simple registry change', function () {
            var source,
                target;

            before(function (done) {
                try {
                    source = getJsonProject('./test/bin/diff/source001.json');
                    target = JSON.parse(JSON.stringify(source));
                    target.nodes['cd891e7b-e2ea-e929-f6cd-9faf4f1fc045'].registry.position = {x: 200, y: 200};
                } catch (err) {
                    done(err);
                    return;
                }
                importCLI.import(storage, gmeConfig, diffCliTest, source, 'source', true, undefined, function (err) {
                    if (err) {
                        done(err);
                        return;
                    }
                    importCLI.import(storage, gmeConfig, diffCliTest, target, 'target', true, undefined, done);
                });
            });

            it('changed registry should be visible in diff source->target', function (done) {
                diffCLI.generateDiff(storage, diffCliTest, 'source', 'target', undefined, function (err, diff) {
                    if (err) {
                        done(err);
                        return;
                    }

                    diff.should.include.key('1');
                    diff['1'].should.include.key('reg');
                    diff['1'].reg.should.include.key('position');
                    diff['1'].reg.position.should.be.eql({x: 200, y: 200});
                    done();
                });
            });

            it('changed registry should be visible in diff target->source', function (done) {
                diffCLI.generateDiff(storage, diffCliTest, 'target', 'source', undefined, function (err, diff) {
                    if (err) {
                        done(err);
                        return;
                    }

                    diff.should.include.key('1');
                    diff['1'].should.include.key('reg');
                    diff['1'].reg.should.include.key('position');
                    diff['1'].reg.position.should.be.eql({x: 100, y: 100});
                    done();
                });
            });
        });
    });
});
