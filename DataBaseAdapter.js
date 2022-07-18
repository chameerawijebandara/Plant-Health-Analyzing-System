import React from 'react';
import * as SQLite from "expo-sqlite";

const db = SQLite.openDatabase('RiceLeafDiseaseDataSet.db');
const table_imageMapping = "RiceLeafDiseaseImageClassification";
const column_ICid = "ICid";
const column_imageName = "imagename";
const column_diseaseId = "diseaseid";

const table_riceLeafDiseases = "RiceLeafDisease";
const column_diseaseName = "diseasename"


const insertAnImage = async (imageName, diseaseName) => {
    const diseaseId = await getDiseaseId(diseaseName);
    return new Promise((resolve, reject) => {
        db.transaction(tx => {
            tx.executeSql('INSERT INTO ' + table_imageMapping + ' (' + column_imageName + ',' + column_diseaseId + ') VALUES (?,?)', [imageName, diseaseId],
                (_, result) => { resolve(true) },
                (_, error) => { reject(false) }
            );
        },
            (t, error) => { },
            (_t, _success) => { }
        )
    })
}

const updateAnImage = async (imageName, diseaseName) => {
    const diseaseId = await getDiseaseId(diseaseName);
    return new Promise((resolve, reject) => {
        if (diseaseId != null) {
            db.transaction(tx => {
                tx.executeSql('UPDATE ' + table_imageMapping + ' SET ' + column_diseaseId + '= ? WHERE ' + column_imageName + ' = ?;', [diseaseId, imageName],
                    (_, result) => { resolve(true) },
                    (_, error) => { reject(false) }
                );
            },
                (t, error) => { },
                (_t, _success) => { }
            )
        } else {
            resolve(false);
        }
    })
}
const getDiseaseId = async (diseaseName) => {
    return new Promise((resolve, reject) => {
        db.transaction(
            tx => {
                tx.executeSql(
                    'SELECT ' + column_diseaseId + ' FROM ' + table_riceLeafDiseases + ' WHERE ' + column_diseaseName + ' = ?',
                    [diseaseName],
                    (_, result) => { resolve(result.rows._array.length == 0 ? null : result.rows._array[0][column_diseaseId]); },
                    (_, error) => { reject(error) },
                );
            },
            (t, error) => { },
            (_t, _success) => { }
        );
    });
}
const insertdisease = async (diseasename) => {
    const result = await getDiseaseId(diseasename);
    return new Promise((resolve, reject) => {
        if (result == null) {
            db.transaction(tx => {
                tx.executeSql('INSERT INTO ' + table_riceLeafDiseases + ' (' + column_diseaseName + ') VALUES (?);', [diseasename],
                    (_, result) => { resolve(true) },
                    (_, error) => { reject(false) }
                );
            },
                (t, error) => { },
                (t, success) => { })
        } else {
            resolve(false);
        }
    })
}

const dropDatabaseTablesAsync = async () => {
    return new Promise((resolve, reject) => {
        db.transaction(tx => {
            tx.executeSql(
                'drop table ' + table_riceLeafDiseases,
                [],
                (_, result) => { resolve(result); },
                (_, error) => {
                    reject(error);
                }
            )
        })
    })
}

const setupDatabaseAsync = async () => {
    return new Promise((resolve, reject) => {
        db.transaction(tx => {
            tx.executeSql(
                'CREATE TABLE IF NOT EXISTS ' + table_riceLeafDiseases + ' (' + column_diseaseId + ' INTEGER PRIMARY KEY AUTOINCREMENT,' + column_diseaseName + ' text);'
            );
            tx.executeSql(
                'CREATE TABLE IF NOT EXISTS ' + table_imageMapping + ' (' + column_ICid + ' INTEGER PRIMARY KEY AUTOINCREMENT,' + column_imageName + ' text,' + column_diseaseId + ' INTEGER,FOREIGN KEY (' + column_diseaseId + ') REFERENCES ' + table_riceLeafDiseases + '(' + column_diseaseId + ') );'
            );
        },
            (_, error) => { reject(error); },
            (_, success) => { resolve(success); }
        )
    })
}


export const database = {
    insertAnImage,
    setupDatabaseAsync,
    insertdisease,
    getDiseaseId,
    dropDatabaseTablesAsync,
    updateAnImage
}

