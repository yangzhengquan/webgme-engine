/*jshint node: true*/
/**
 * @author kecso / https://github.com/kecso
 */

var Q = require('q'),
    webgme = require('../../webgme'),
    FS = require('fs'),
    path = require('path'),
    gmeConfig = require(path.join(process.cwd(), 'config')),
    Project = require('../../src/server/storage/userproject'),

    Core = webgme.core,
    cliStorage,
    gmeAuth,
    logger = webgme.Logger.create('gme:bin:merge', gmeConfig.bin.log),
    REGEXP = webgme.REGEXP;


var merge = function (database, projectId, sourceBranchOrCommit, targetBranchOrCommit, autoMerge, userName, callback) {
        'use strict';

        var project,
            core,
            myCommitHash,
            theirCommitHash,
            baseCommitHash,
            myDiff,
            theirDiff,
            baseRoot,
            myRoot,
            theirRoot,
            conflict,
            error = null,
            result = {},
            getRoot = function (commitHash, next) {
                project.loadObject(commitHash, function (err, commit) {
                    if (err || !commit) {
                        next(err || new Error('unknown commit hash: ', commitHash));
                        return;
                    }
                    core.loadRoot(commit.root, next);
                });
            },
            finishUp = function () {
                database.closeDatabase(function () {
                    callback(error,result);
                });
            };

        database.openDatabase(function (err) {
            var openProjectData = {
                projectName: projectId
            };
            if (userName) {
                openProjectData.username = userName;
            }

            if (err) {
                error = err;
                finishUp();
                return;
            }
            database.openProject(openProjectData, function (err, p) {
                var baseCommitCalculated = function (err, bc) {
                        if (err) {
                            error = error || err;
                            finishUp();
                            return;
                        }
                        baseCommitHash = bc;
                        result.baseCommitHash = bc;
                        needed = 2;

                        getRoot(baseCommitHash, function (err, root) {
                            if (err || !root) {
                                error = error || err || new Error('unknown root object');
                                finishUp();
                                return;
                            }
                            baseRoot = root;

                            calculateDiff(true, diffCalculated);
                            calculateDiff(false, diffCalculated);
                        });

                    },
                    diffCalculated = function (err) {
                        error = error || err;
                        if (--needed === 0) {
                            if (error) {
                                finishUp();
                                return;
                            }
                            diffsGenerated();
                        }
                    },
                    calculateDiff = function (isMine, next) {
                        var commitHash = isMine ? myCommitHash : theirCommitHash;

                        getRoot(commitHash, function (err, root) {
                            if (err || !root) {
                                next(err || new Error('unknown object'));
                                return;
                            }
                            if (isMine) {
                                myRoot = root;
                            } else {
                                theirRoot = root;
                            }
                            core.generateTreeDiff(baseRoot, root, function (err, diff) {
                                if (err) {
                                    next(err);
                                    return;
                                }

                                if (isMine) {
                                    myRoot = root;
                                    myDiff = diff;
                                    result.diff = result.diff || {};
                                    result.diff.mine = diff;
                                } else {
                                    theirRoot = root;
                                    theirDiff = diff;
                                    result.diff = result.diff || {};
                                    result.diff.theirs = diff;
                                }
                                next();
                            });
                        });
                    },
                    diffsGenerated = function () {
                        //so we are ready with the first phase, let's create the conflict object
                        conflict = core.tryToConcatChanges(myDiff, theirDiff);
                        result.confilct = conflict;
                        var autoFailureReason;

                        if (autoMerge === true && conflict !== null && conflict.items.length === 0) {
                            //we try to apply our merge if possible
                            core.applyTreeDiff(baseRoot, conflict.merge, function (err) {
                                if (err) {
                                    error = err;
                                    finishUp();
                                    return;
                                }

                                var persisted = core.persist(baseRoot);
                                project.makeCommit(null,
                                    [myCommitHash, theirCommitHash],
                                    persisted.rootHash,
                                    persisted.objects,
                                    'merging [' + sourceBranchOrCommit + '] into [' +
                                    targetBranchOrCommit + ']',
                                    function (err, commitResult) {
                                        if (err) {
                                            logger.error('project.makeCommit failed.');
                                            error = err;
                                            finishUp();
                                            return;
                                        }

                                        result.finalCommitHash = commitResult.hash;
                                        if (REGEXP.BRANCH.test(targetBranchOrCommit)) {
                                            var branchParameters = {
                                                branchName: targetBranchOrCommit,
                                                projectName: projectId,
                                                oldHash: theirCommitHash,
                                                newHash: commitResult.hash
                                            };
                                            if (userName) {
                                                branchParameters.username = userName;
                                            }
                                            database.setBranchHash(branchParameters, function (err, updateResult) {
                                                    if (err) {
                                                        logger.error('setBranchHash failed with error.');
                                                        error = err;
                                                        finishUp();
                                                        return;
                                                    }

                                                    result.updatedBranch = targetBranchOrCommit;
                                                    logger.info('merge was done to branch [' + targetBranchOrCommit + ']');
                                                    error = null;
                                                    finishUp();
                                                }
                                            );
                                        } else {
                                            error = null;
                                            finishUp();
                                        }

                                    }
                                );
                            });

                        } else {
                            if (autoMerge === true) {
                                if (conflict === null) {
                                    autoFailureReason = ' cannot do automatic merge as empty ' +
                                        'conflict object was generated';
                                } else if (conflict.item.length > 0) {
                                    autoFailureReason = 'cannot do automatic merge as there are ' +
                                        'conflicts that cannot be resolved';
                                }
                                error = error || new Error(autoFailureReason);
                                finishUp();
                            }
                        }
                    },
                    needed,
                    commitSearched = function (err) {
                        error = error || err;
                        if (--needed === 0) {
                            //we can go to the next step
                            if (error) {
                                finishUp();
                                return;
                            }
                            project.getCommonAncestorCommit(myCommitHash, theirCommitHash, baseCommitCalculated);
                        }
                    },
                    getCommitHash = function (isMine, inputIdentifier, next) {
                        if (REGEXP.HASH.test(inputIdentifier)) {
                            if (isMine) {
                                myCommitHash = inputIdentifier;
                            } else {
                                theirCommitHash = inputIdentifier;
                            }
                            next();
                        } else if (REGEXP.BRANCH.test(inputIdentifier)) {
                            project.getBranches(function (err, branches) {
                                if (err) {
                                    next(err);
                                    return;
                                }
                                if (!branches[inputIdentifier]) {
                                    next('unknown branch [' + inputIdentifier + ']');
                                    return;
                                }

                                if (isMine) {
                                    myCommitHash = branches[inputIdentifier];
                                } else {
                                    theirCommitHash = branches[inputIdentifier];
                                }
                                next();
                            });
                        }
                    };

                if (err) {
                    callback(err, result);
                    return;
                }

                project = new Project(p, database, logger, gmeConfig);
                if (userName) {
                    project.setUser(userName);
                }
                core = new Core(project, {globConf: gmeConfig, logger: logger.fork('core')});

                needed = 2;
                getCommitHash(true, sourceBranchOrCommit, commitSearched);
                getCommitHash(false, targetBranchOrCommit, commitSearched);
            });
        });
    },
    main = function (argv) {
        'use strict';
        var Command = require('commander').Command,
            program = new Command(),
            mainDeferred = Q.defer();

        logger.debug(argv);
        program
            .version('0.1.0')
            .option('-m, --mongo-database-uri [uri]', 'URI to connect to mongoDB where the project is stored')
            .option('-u, --user [string]', 'the user of the command')
            .option('-p, --project-identifier [value]', 'project identifier')
            .option('-M, --mine [branch/commit]', 'my version of the project')
            .option('-T, --theirs [branch/commit]', 'their version of the project')
            .option('-P, --path-prefix [value]', 'path prefix for the output diff files')
            .option('-a, --auto-merge', 'if given then we try to automatically merge into their branch/commit')
            .parse(argv);

        //check necessary arguments
        if (!program.mongoDatabaseUri && !gmeConfig.mongo.uri) {
            logger.error('there is no preconfigured mongoDb commection so the mongo-database-uri' +
                'parameter is mandatory');
            program.outputHelp();
            mainDeferred.reject(new SyntaxError('invalid mongo database connection parameter'));
            return mainDeferred.promise;
        }
        if (!program.projectIdentifier) {
            program.outputHelp();
            mainDeferred.reject(new SyntaxError('project identifier is a mandatory parameter!'));
            return mainDeferred.promise;
        }
        if (!program.mine) {
            program.outputHelp();
            mainDeferred.reject(new SyntaxError('my branch/commit parameter is mandatory!'));
            return mainDeferred.promise;
        } else if (!(REGEXP.HASH.test(program.mine) || REGEXP.BRANCH.test(program.mine))) {
            program.outputHelp();
            mainDeferred.reject(new SyntaxError('invalid \'mine\' parameter!'));
            return mainDeferred.promise;
        }
        if (!program.theirs) {
            program.outputHelp();
            mainDeferred.reject(new SyntaxError('their branch/commit parameter is mandatory!'));
            return mainDeferred.promise;
        } else if (!(REGEXP.HASH.test(program.theirs) || REGEXP.BRANCH.test(program.theirs))) {
            program.outputHelp();
            mainDeferred.reject(new SyntaxError('invalid \'theirs\' parameter!'));
            return mainDeferred.promise;
        }

        webgme.getGmeAuth(gmeConfig)
            .then(function (gmeAuth__) {
                gmeAuth = gmeAuth__;
                cliStorage = webgme.getStorage(logger.fork('storage'), gmeConfig, gmeAuth);
                return cliStorage.openDatabase();
            })
            .then(function () {
                merge(cliStorage,
                    program.projectIdentifier, program.mine, program.theirs, program.autoMerge, program.user,
                    function (err, result) {
                        if (err) {
                            logger.warn('merging failed: ', err);
                        }
                        //it is possible that we have enough stuff to still print some results to the screen or to some file
                        if (result.updatedBranch) {
                            logger.info('branch [' + result.updatedBranch +
                                '] was successfully updated with the merged result');
                        } else if (result.finalCommitHash) {
                            logger.info('merge was successfully saved to commit [' +
                                result.finalCommitHash + ']');
                        } else if (result.baseCommitHash && result.diff.mine && result.diff.theirs) {
                            logger.info('to finish merge you have to apply your changes to commit[' +
                                result.baseCommitHash + ']');
                        }

                        if (program.pathPrefix) {
                            if (result.diff.mine && result.diff.theirs) {
                                FS.writeFileSync(program.pathPrefix + '.mine',
                                    JSON.stringify(result.diff.mine, null, 2));
                                FS.writeFileSync(program.pathPrefix + '.theirs',
                                    JSON.stringify(result.diff.theirs, null, 2));
                                if (result.conflict) {
                                    FS.writeFileSync(program.pathPrefix + '.conflict',
                                        JSON.stringify(result.conflict, null, 2));
                                }
                            }
                        } else if (!result.updatedBranch && !result.finalCommitHash) {
                            // If there were no prefix given we put anything to console only if the merge failed
                            // at some point or was not even tried.
                            if (result.diff.mine && result.diff.theirs) {
                                logger.debug('diff base->mine:');
                                logger.debug(JSON.stringify(result.diff.mine, null, 2));
                                logger.debug('diff base->theirs:');
                                logger.debug(JSON.stringify(result.diff.theirs, null, 2));
                                if (result.conflict) {
                                    logger.warn('conflict object:');
                                    logger.warn(JSON.stringify(result.conflict, null, 2));
                                }
                            }
                        }
                        mainDeferred.resolve();
                    }
                );
            })
            .catch(function (err) {
                mainDeferred.reject(err);
                return mainDeferred.promise;
            });
        return mainDeferred.promise;
    };

module.exports = {
    main: main,
    merge: merge
};
if (require.main === module) {
    main(process.argv)
        .then(function () {
            'use strict';
            logger.info('Done');
            process.exit(0);
        })
        .catch(function (err) {
            'use strict';
            logger.error('ERROR : ' + err);
            process.exit(1);
        });
}
