import { Request, Response } from 'express';
import { runDiagnosticEngine } from '../services/diagnosticService.js';
import { buildAdjacencyMatrix, findBottlenecks, getDependencyChain } from '../services/matrixService.js';

export const getDiagnosticReport = async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(req.params.studentId);
    const topicId = parseInt(req.params.topicId);
    const classId = parseInt(req.params.classId);
    const subjectId = parseInt(req.params.subjectId);

    if (isNaN(studentId) || isNaN(topicId) || isNaN(classId) || isNaN(subjectId)) {
       return res.status(400).json({ error: 'Faltan parámetros o son inválidos (studentId, topicId, classId, subjectId)' });
    }

    // Correr Diagnostic Engine
    const report = await runDiagnosticEngine(studentId, topicId, classId, subjectId);

    // Generar Matrices y Grafo
    const matrix = await buildAdjacencyMatrix(studentId);
    const bottlenecks = await findBottlenecks(studentId, 50); // score < 50
    const dependencyChain = await getDependencyChain(topicId);

    // Adjuntar Análisis de Grafo al Reporte
    const fullReport = {
      ...report,
      matrix_analysis: {
        adjacency_graph: matrix,
        dependency_chain: dependencyChain,
        bottlenecks: bottlenecks
      }
    };

    return res.status(200).json(fullReport);

  } catch (error) {
    console.error('Error in getDiagnosticReport:', error);
    return res.status(500).json({ error: 'Error interno ejecutando diagnóstico' });
  }
};
