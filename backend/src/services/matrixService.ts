import { fetchTopicRelations, fetchStudentScores, fetchTopicName } from './diagnosticService.js';

export interface MatrixNode {
  id_topic: number;
  name?: string;
  score: number;
  parents: Array<{ id_topic: number; correlation: number }>;
  children: Array<{ id_topic: number; correlation: number }>;
}

export interface Bottleneck {
  id_topic: number;
  name: string;
  score: number;
  blocks_count: number;
  blocks_topics: string[];
}

export async function buildAdjacencyMatrix(studentId: number) {
  // Fetch raw data
  const relations = await fetchTopicRelations();
  const studentScoresMap = await fetchStudentScores(studentId);

  // Extract unique topic IDs from relations
  const topicIds = new Set<number>();
  for (const rel of relations) {
    topicIds.add(rel.id_topic_father);
    topicIds.add(rel.id_topic_son);
  }

  // Pre-fetch all names
  const topicNames: Record<number, string> = {};
  for (const tid of topicIds) {
    topicNames[tid] = await fetchTopicName(tid);
  }

  const nodes: Record<number, MatrixNode> = {};

  // Initialize node structure
  for (const tid of topicIds) {
    nodes[tid] = {
      id_topic: tid,
      name: topicNames[tid],
      score: studentScoresMap[tid]?.score_pct || 0,
      parents: [],
      children: [],
    };
  }

  // Populate graph relationships
  for (const rel of relations) {
    const father = nodes[rel.id_topic_father];
    const son = nodes[rel.id_topic_son];

    if (father && son) {
      father.children.push({ id_topic: son.id_topic, correlation: rel.correlation_coefficient });
      son.parents.push({ id_topic: father.id_topic, correlation: rel.correlation_coefficient });
    }
  }

  return { nodes, topicIds: Array.from(topicIds) };
}

export async function findBottlenecks(studentId: number, threshold: number = 50.0): Promise<Bottleneck[]> {
  const { nodes, topicIds } = await buildAdjacencyMatrix(studentId);

  const bottlenecks: Bottleneck[] = [];

  for (const tid of topicIds) {
    const node = nodes[tid];
    if (node.score < threshold) {
      // Find what it blocks using BFS/DFS
      const blockedSet = new Set<string>();
      const queue = [tid];
      const visited = new Set<number>();

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        const current = nodes[currentId];
        if (current) {
          for (const child of current.children) {
            blockedSet.add(nodes[child.id_topic].name || `Topic ${child.id_topic}`);
            queue.push(child.id_topic);
          }
        }
      }

      if (blockedSet.size > 0) {
        bottlenecks.push({
          id_topic: node.id_topic,
          name: node.name || `Topic ${node.id_topic}`,
          score: node.score,
          blocks_count: blockedSet.size,
          blocks_topics: Array.from(blockedSet),
        });
      }
    }
  }

  // Sort by highest blocking count
  bottlenecks.sort((a, b) => b.blocks_count - a.blocks_count);
  return bottlenecks;
}

export async function getDependencyChain(topicId: number, stopDepth: number = 5) {
  const relations = await fetchTopicRelations();
  
  // Inverse mappings: topic -> parents
  const graph: Record<number, Array<{ id: number; corr: number }>> = {};
  for (const rel of relations) {
    if (!graph[rel.id_topic_son]) graph[rel.id_topic_son] = [];
    graph[rel.id_topic_son].push({ id: rel.id_topic_father, corr: rel.correlation_coefficient });
  }

  if (!graph[topicId]) {
    const name = await fetchTopicName(topicId);
    return { id_topic: topicId, name, text: `[ROOT] ${name} (ID ${topicId})`, dependencies: [] };
  }

  // Build recursive structure
  async function buildLevel(currId: number, depth: number): Promise<any> {
    if (depth >= stopDepth) return null;
    const name = await fetchTopicName(currId);
    
    const parents = graph[currId] || [];
    if (parents.length === 0) {
       return { id_topic: currId, name, dependencies: [] };
    }

    const dependencies = [];
    for (const p of parents) {
       const sub = await buildLevel(p.id, depth + 1);
       if (sub) {
           sub.correlation_to_child = p.corr;
           dependencies.push(sub);
       }
    }

    return { id_topic: currId, name, dependencies };
  }

  return await buildLevel(topicId, 0);
}
